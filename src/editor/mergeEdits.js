// Keep untouched parts of a post byte for byte when the editor saves.
// MDXEditor rewrites the whole file on export (indents JSX children, joins blank lines, ...).
// So instead of saving its export, we take only the lines it changed and patch them into the file:
//   base   = the editor's export as loaded (or last saved)
//   theirs = the editor's export now
//   ours   = the file on disk
// The base-to-theirs changes are mapped onto the file by matching lines that differ only in whitespace.
import { diffArrays } from 'diff';

const norm = (line) => line.trim().replace(/\s+/g, ' ');
const indent = (line) => line.match(/^\s*/)[0];

export function mergeEdits(base, ours, theirs) {
  const O = base.split('\n');
  const A = ours.split('\n');
  const B = theirs.split('\n');

  // Line i of the base matches line toA[i] of the file (or is missing there).
  const toA = new Array(O.length).fill(-1);
  let o = 0, a = 0;
  for (const part of diffArrays(O, A, { comparator: (x, y) => norm(x) === norm(y) })) {
    if (part.added) a += part.count;
    else if (part.removed) o += part.count;
    else for (let k = 0; k < part.count; k++) toA[o++] = a++;
  }

  // What the editor changed: base lines [start, end) became `lines`.
  const hunks = [];
  o = 0;
  let pending = null;
  for (const part of diffArrays(O, B)) {
    if (!part.added && !part.removed) {
      if (pending) hunks.push(pending);
      pending = null;
      o += part.count;
      continue;
    }
    pending ??= { start: o, end: o, lines: [] };
    if (part.added) pending.lines.push(...part.value);
    else { o += part.count; pending.end = o; }
  }
  if (pending) hunks.push(pending);

  const prevMatch = (i) => { while (i >= 0 && toA[i] < 0) i--; return i < 0 ? -1 : toA[i]; };
  const nextMatch = (i) => { while (i < O.length && toA[i] < 0) i++; return i >= O.length ? A.length : toA[i]; };

  // Patch from the bottom up, so earlier positions in the file stay valid.
  for (const { start, end, lines } of hunks.reverse()) {
    const inside = [];
    for (let i = start; i < end; i++) if (toA[i] >= 0) inside.push(i);
    const allMatched = end > start && inside.length === end - start;
    const aStart = allMatched ? toA[start] : prevMatch(start - 1) + 1;
    const aEnd = end === start ? aStart : allMatched ? toA[end - 1] + 1 : nextMatch(end);

    // The editor indents JSX children; the file may not. Undo that indent on the new lines.
    let ref = inside.find((i) => O[i].trim());
    for (let i = start - 1; ref === undefined && i >= 0; i--) if (toA[i] >= 0 && O[i].trim()) ref = i;
    let extra = '';
    if (ref !== undefined) {
      const io = indent(O[ref]), ia = indent(A[toA[ref]]);
      if (io.startsWith(ia)) extra = io.slice(ia.length);
    }
    const out = extra ? lines.map((l) => (l.startsWith(extra) ? l.slice(extra.length) : l)) : lines;
    A.splice(aStart, Math.max(0, aEnd - aStart), ...out);
  }
  return A.join('\n');
}
