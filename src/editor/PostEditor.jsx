// Dev-only visual editor for blog posts (served at /edit under `astro dev`, never built).
// MDXEditor with rich text, raw source and a diff against the saved file. Saves through /api/edit/<slug>.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MDXEditor, headingsPlugin, listsPlugin, quotePlugin, linkPlugin, linkDialogPlugin, tablePlugin,
  thematicBreakPlugin, markdownShortcutPlugin, toolbarPlugin, codeBlockPlugin, codeMirrorPlugin,
  diffSourcePlugin, frontmatterPlugin, jsxPlugin, DiffSourceToggleWrapper, UndoRedo,
  BoldItalicUnderlineToggles, BlockTypeSelect, ListsToggle, CreateLink, InsertTable,
  InsertThematicBreak, InsertCodeBlock, InsertFrontmatter, Separator,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import 'katex/dist/katex.min.css';
import { mergeEdits } from './mergeEdits.js';
import { mathPlugin } from './mathPlugin.jsx';
import { rawMdxPlugin, importedComponents, jsxDescriptors, InsertFigure } from './figures.jsx';

// Fewer gratuitous changes on export. Citations like [@key] are not links, so their bracket needs no escape.
const TO_MARKDOWN = {
  bullet: '-',
  listItemIndent: 'one',
  handlers: { text: (node, parent, state, info) => state.safe(node.value, info).replace(/\\\[@/g, '[@') },
};

export default function PostEditor({ slug, slugs }) {
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/edit/${slug}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then(setSaved, (e) => setError(String(e)));
  }, [slug]);

  if (!slug) {
    return (
      <main className="edit-index">
        <h1>Edit a post</h1>
        <ul>{slugs.map((s) => <li key={s}><a href={`/edit/${s}`}>{s}</a></li>)}</ul>
      </main>
    );
  }
  if (error) return <p className="edit-error">Could not load {slug}: {error}</p>;
  if (saved === null) return <p>Loading {slug}...</p>;
  return <Editor slug={slug} initial={saved} />;
}

function Editor({ slug, initial }) {
  const ref = useRef(null);
  const [base, setBase] = useState(null); // the editor's export of the file as last loaded or saved
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const components = useMemo(() => importedComponents(initial), [initial]);

  // Until MDXEditor reports its first export (the normalized load), the file itself is the base.
  useEffect(() => {
    setBase((b) => b ?? initial);
    window.__postEditor = ref.current; // for scripted round-trip checks
  }, [initial]);

  // Astro reloads every open page when any post changes, including after our own save.
  // Hold those reloads so the editor keeps its state (reload by hand to pick up other changes).
  useEffect(() => {
    const hold = () => new Promise(() => {});
    import.meta.hot?.on('vite:beforeFullReload', hold);
    return () => import.meta.hot?.off?.('vite:beforeFullReload', hold);
  }, []);

  const save = useCallback(async () => {
    const theirs = ref.current?.getMarkdown();
    if (theirs == null || base == null) return;
    setStatus('Saving...');
    // Read the file again, so edits made elsewhere (for example in VS Code) are merged, not lost.
    const disk = await fetch(`/api/edit/${slug}`).then((r) => r.text());
    const merged = mergeEdits(base, disk, theirs);
    if (merged !== disk) {
      const r = await fetch(`/api/edit/${slug}`, { method: 'PUT', body: merged });
      if (!r.ok) { setStatus(`Save failed: ${await r.text()}`); return; }
    }
    setBase(theirs);
    setDirty(false);
    setStatus(merged === disk ? 'No changes to save' : `Saved ${new Date().toLocaleTimeString()}`);
  }, [slug, base]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    };
    const onLeave = (e) => { if (dirty) e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onLeave); };
  }, [save, dirty]);

  // Plugins are set up on mount; later only the diff target (the last saved version) changes.
  const plugins = useMemo(() => [
    frontmatterPlugin(),
    rawMdxPlugin(),
    mathPlugin(),
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin({ tablePipeAlign: false, tableCellPadding: true }),
    thematicBreakPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
    codeMirrorPlugin({ codeBlockLanguages: { '': 'Plain', js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', py: 'Python', python: 'Python', bash: 'Bash', yaml: 'YAML', json: 'JSON', tex: 'TeX' } }),
    jsxPlugin({ jsxComponentDescriptors: jsxDescriptors(components) }),
    diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: base ?? '' }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarContents: () => (
        <DiffSourceToggleWrapper>
          <UndoRedo />
          <Separator />
          <BoldItalicUnderlineToggles />
          <BlockTypeSelect />
          <ListsToggle />
          <Separator />
          <CreateLink />
          <InsertTable />
          <InsertThematicBreak />
          <InsertCodeBlock />
          <InsertFrontmatter />
          <Separator />
          <InsertFigure components={components} />
        </DiffSourceToggleWrapper>
      ),
    }),
  ], [components, base]);

  return (
    <div className="edit-shell">
      <header className="edit-bar">
        <a href="/edit">All posts</a>
        <strong>{slug}.mdx</strong>
        <a href={`/blog/${slug}/`} target="_blank" rel="noopener">View post</a>
        <span className="edit-status">{dirty ? 'Unsaved changes' : status}</span>
        <button type="button" onClick={save}>Save</button>
      </header>
      <MDXEditor
        ref={ref}
        markdown={initial}
        trim={false}
        toMarkdownOptions={TO_MARKDOWN}
        plugins={plugins}
        onChange={(md, initialNormalize) => (initialNormalize ? setBase(md) : setDirty(true))}
        onError={({ error }) => setStatus(`Parse problem: ${error}. Switch to source mode to fix it.`)}
        contentEditableClassName="edit-content"
      />
    </div>
  );
}
