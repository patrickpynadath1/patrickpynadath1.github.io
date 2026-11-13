// JSX for the dev-only editor: how the post's components show up, and how to insert and move them.
// Figures are locked blocks labelled with their name. RunConfig has an editable id and
// ExpandableSection an editable title with editable markdown inside. Every other attribute
// (client:visible, client:load, ...) is kept as it was.
import { DecoratorNode, $getNodeByKey } from 'lexical';
import {
  NestedLexicalEditor, NESTED_EDITOR_UPDATED_COMMAND, useNestedEditorContext, useMdastNodeUpdater, insertJsx$, usePublisher,
  Select, realmPlugin, addImportVisitor$, addExportVisitor$, addLexicalNode$,
} from '@mdxeditor/editor';

const SECTION = 'ExpandableSection';
const EDITABLE = { RunConfig: 'id', [SECTION]: 'title', MapText: 'name' };
// Components whose children are editable markdown (DesignMap holds MapText blocks).
const NESTED = new Set([SECTION, 'MapText', 'DesignMap']);

/** Components imported at the top of the post: [{ name, source, isDefault }]. */
export function importedComponents(markdown) {
  const out = [];
  const re = /^import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+["']([^"']+)["']/gm;
  for (const m of markdown.matchAll(re)) {
    if (m[1]) out.push({ name: m[1], source: m[3], isDefault: true });
    else for (const n of m[2].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
      out.push({ name: n, source: m[3], isDefault: false });
    }
  }
  return out.filter((c) => /^[A-Z]/.test(c.name));
}

// ---- attributes -------------------------------------------------------------

const attrOf = (node, name) => node.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);

function withAttr(node, name, value) {
  const attributes = node.attributes.map((a) => (a.type === 'mdxJsxAttribute' && a.name === name ? { ...a, value } : a));
  if (!attrOf(node, name)) attributes.push({ type: 'mdxJsxAttribute', name, value });
  return attributes;
}

function AttrField({ mdastNode, name }) {
  const update = useMdastNodeUpdater();
  const attr = attrOf(mdastNode, name);
  const value = typeof attr?.value === 'string' ? attr.value : '';
  return (
    <label className="fig-attr">
      {name}
      <input
        defaultValue={value}
        size={Math.max(12, value.length)}
        onKeyDown={(e) => e.stopPropagation()}
        onBlur={(e) => { if (e.target.value !== value) update({ attributes: withAttr(mdastNode, name, e.target.value) }); }}
      />
    </label>
  );
}

// ---- move / delete ----------------------------------------------------------

function BlockControls() {
  const { parentEditor, lexicalNode } = useNestedEditorContext();
  const act = (fn) => parentEditor.update(() => {
    const node = $getNodeByKey(lexicalNode.getKey());
    if (node) fn(node);
  }, { onUpdate: () => parentEditor.dispatchCommand(NESTED_EDITOR_UPDATED_COMMAND, undefined) });
  return (
    <span className="fig-controls">
      <button type="button" title="Move up" onClick={() => act((n) => n.getPreviousSibling()?.insertBefore(n))}>↑</button>
      <button type="button" title="Move down" onClick={() => act((n) => n.getNextSibling()?.insertAfter(n))}>↓</button>
      <button type="button" title="Delete" onClick={() => act((n) => n.remove())}>×</button>
    </span>
  );
}

function clientAttrs(node) {
  return node.attributes
    .filter((a) => a.type === 'mdxJsxAttribute' && a.name.startsWith('client:'))
    .map((a) => a.name).join(' ');
}

// ---- editors ----------------------------------------------------------------

function FigureEditor({ mdastNode }) {
  const editable = EDITABLE[mdastNode.name];
  return (
    <div className="fig-block" contentEditable={false}>
      <span className="fig-name">{mdastNode.name}</span>
      <span className="fig-client">{clientAttrs(mdastNode)}</span>
      {editable && <AttrField mdastNode={mdastNode} name={editable} />}
      <BlockControls />
    </div>
  );
}

function SectionEditor({ mdastNode }) {
  return (
    <div className="fig-block fig-section">
      <div className="fig-section-head" contentEditable={false}>
        <span className="fig-name">{mdastNode.name}</span>
        {EDITABLE[mdastNode.name] && <AttrField mdastNode={mdastNode} name={EDITABLE[mdastNode.name]} />}
        <span className="fig-client">{clientAttrs(mdastNode)}</span>
        <BlockControls />
      </div>
      <NestedLexicalEditor
        block
        getContent={(node) => node.children}
        getUpdatedMdastNode={(node, children) => ({ ...node, children })}
      />
    </div>
  );
}

// Anything else that is not HTML (for example the <svg> inside the GitHub button) is kept as is.
function RawJsxEditor({ mdastNode }) {
  return <span className="raw-jsx" contentEditable={false} title="Kept as written. Edit in source mode.">&lt;{mdastNode.name ?? ''}&gt;</span>;
}

export function jsxDescriptors(components) {
  const descriptors = components.map(({ name, source, isDefault }) => ({
    name,
    kind: 'flow',
    source,
    defaultExport: isDefault,
    props: EDITABLE[name] ? [{ name: EDITABLE[name], type: 'string' }] : [],
    hasChildren: NESTED.has(name),
    Editor: NESTED.has(name) ? SectionEditor : FigureEditor,
  }));
  descriptors.push({ name: '*', kind: 'flow', props: [], hasChildren: true, Editor: RawJsxEditor });
  return descriptors;
}

// ---- toolbar: insert a figure -----------------------------------------------

export function InsertFigure({ components }) {
  const insertJsx = usePublisher(insertJsx$);
  const items = components.map((c) => ({ value: c.name, label: c.name }));
  return (
    <Select
      value=""
      placeholder="Insert figure"
      triggerTitle="Insert a figure"
      items={items}
      onChange={(name) => {
        if (!name) return;
        const props = name === SECTION ? { 'client:load': null } : name.endsWith('.astro') || NESTED.has(name) ? {} : { 'client:visible': null };
        if (EDITABLE[name]) props[EDITABLE[name]] = { [SECTION]: 'Title', MapText: 'about.part' }[name] ?? 'run-id';
        const children = NESTED.has(name)
          ? [{ type: 'paragraph', children: [{ type: 'text', value: 'Write here.' }] }]
          : [];
        insertJsx({ name, kind: 'flow', props, children });
      }}
    />
  );
}

// ---- import lines and {/* comments */}: kept word for word ------------------

const RAW_TYPES = ['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression'];

class RawNode extends DecoratorNode {
  static getType() { return 'raw-mdx'; }
  static clone(node) { return new RawNode(node.__mdast, node.__key); }
  static importJSON(json) { return new RawNode(json.mdast); }
  constructor(mdast, key) { super(key); this.__mdast = mdast; }
  exportJSON() { return { type: 'raw-mdx', version: 1, mdast: this.__mdast }; }
  createDOM() { return document.createElement(this.isInline() ? 'span' : 'div'); }
  updateDOM() { return false; }
  isInline() { return this.__mdast.type === 'mdxTextExpression'; }
  getMdast() { return this.getLatest().__mdast; }
  decorate() {
    const { type, value } = this.__mdast;
    const text = type === 'mdxjsEsm' ? value : `{${value}}`;
    return this.isInline()
      ? <code className="raw-jsx" title="Edit in source mode">{text}</code>
      : <pre className="raw-esm" contentEditable={false} title="Kept as written. Edit in source mode.">{text}</pre>;
  }
}

// For import lines, the specifiers tell MDXEditor these names are already imported,
// so it adds no import lines of its own.
function specifiers(node) {
  return (node.data?.estree?.body ?? []).flatMap((d) => (d.type !== 'ImportDeclaration' ? [] : d.specifiers.map((s) => ({
    source: String(d.source.value),
    kind: s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportNamespaceSpecifier' ? 'namespace' : 'named',
    defaultExport: s.type === 'ImportDefaultSpecifier',
    importedName: s.type === 'ImportSpecifier' ? (s.imported.name ?? String(s.imported.value)) : s.type === 'ImportDefaultSpecifier' ? 'default' : '*',
    localName: s.local.name,
  }))));
}

export const rawMdxPlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addLexicalNode$]: RawNode,
      [addImportVisitor$]: {
        testNode: (node) => RAW_TYPES.includes(node.type),
        priority: 100,
        visitNode({ mdastNode, lexicalParent }) {
          const { type, value } = mdastNode;
          const data = type === 'mdxjsEsm' ? { mdxEditorImports: specifiers(mdastNode) } : undefined;
          lexicalParent.append(new RawNode({ type, value, data }));
        },
      },
      [addExportVisitor$]: {
        testLexicalNode: (node) => node instanceof RawNode,
        visitLexicalNode({ actions, mdastParent, lexicalNode }) {
          actions.appendToParent(mdastParent, { ...lexicalNode.getMdast() });
        },
      },
    });
  },
});
