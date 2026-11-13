// Math for the dev-only editor: $...$ (inline) and $$...$$ (display) round-trip as raw TeX.
// The math syntax is parsed before MDX sees it, so braces in TeX are never read as JSX expressions.
// Each formula is a Lexical decorator node drawn with KaTeX; click it to edit the TeX.
import { useEffect, useRef, useState } from 'react';
import { DecoratorNode, $getNodeByKey } from 'lexical';
import katex from 'katex';
import { math } from 'micromark-extension-math';
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math';
import {
  realmPlugin, NESTED_EDITOR_UPDATED_COMMAND, addImportVisitor$, addExportVisitor$, addLexicalNode$,
  addMdastExtension$, addSyntaxExtension$, addToMarkdownExtension$,
} from '@mdxeditor/editor';

export class MathNode extends DecoratorNode {
  static getType() { return 'tex-math'; }
  static clone(node) { return new MathNode(node.__tex, node.__inline, node.__key); }
  static importJSON(json) { return new MathNode(json.tex, json.inline); }

  constructor(tex, inline, key) {
    super(key);
    this.__tex = tex;
    this.__inline = inline;
  }

  exportJSON() { return { type: 'tex-math', version: 1, tex: this.__tex, inline: this.__inline }; }
  createDOM() { return document.createElement(this.__inline ? 'span' : 'div'); }
  updateDOM() { return false; }
  isInline() { return this.__inline; }
  getTex() { return this.getLatest().__tex; }
  setTex(tex) { this.getWritable().__tex = tex; }
  getTextContent() { return this.__inline ? `$${this.__tex}$` : `$$\n${this.__tex}\n$$`; }

  decorate(editor) {
    return <MathView tex={this.__tex} inline={this.__inline} nodeKey={this.__key} editor={editor} />;
  }
}

function MathView({ tex, inline, nodeKey, editor }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tex);
  const input = useRef(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft === tex) return;
    // Inside a nested editor (an ExpandableSection), the command tells the section to save its content.
    editor.update(() => $getNodeByKey(nodeKey)?.setTex(draft), {
      onUpdate: () => editor.dispatchCommand(NESTED_EDITOR_UPDATED_COMMAND, undefined),
    });
  };

  if (editing) {
    const Field = inline ? 'input' : 'textarea';
    return (
      <Field
        ref={input}
        className={inline ? 'tex-edit tex-edit-inline' : 'tex-edit tex-edit-block'}
        value={draft}
        rows={inline ? undefined : Math.max(2, draft.split('\n').length)}
        size={inline ? Math.max(4, draft.length) : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') { setDraft(tex); setEditing(false); }
          if (e.key === 'Enter' && (inline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
        }}
      />
    );
  }

  let html;
  try {
    html = katex.renderToString(tex, { displayMode: !inline, throwOnError: true });
  } catch (err) {
    html = `<span class="tex-error" title="${String(err.message).replace(/"/g, '&quot;')}">${tex.replace(/</g, '&lt;')}</span>`;
  }
  return (
    <span
      className={inline ? 'tex-view tex-view-inline' : 'tex-view tex-view-block'}
      title="Click to edit the TeX"
      onClick={() => { setDraft(tex); setEditing(true); }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const isMathNode = (node) => node instanceof MathNode;

const importMath = {
  testNode: (node) => node.type === 'math' || node.type === 'inlineMath',
  visitNode({ mdastNode, lexicalParent }) {
    lexicalParent.append(new MathNode(mdastNode.value, mdastNode.type === 'inlineMath'));
  },
};

const exportMath = {
  testLexicalNode: isMathNode,
  visitLexicalNode({ actions, mdastParent, lexicalNode }) {
    actions.appendToParent(mdastParent, {
      type: lexicalNode.isInline() ? 'inlineMath' : 'math',
      value: lexicalNode.getTex(),
    });
  },
};

export const mathPlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addSyntaxExtension$]: math(),
      [addMdastExtension$]: mathFromMarkdown(),
      [addToMarkdownExtension$]: mathToMarkdown(),
      [addLexicalNode$]: MathNode,
      [addImportVisitor$]: importMath,
      [addExportVisitor$]: exportMath,
    });
  },
});
