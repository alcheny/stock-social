// A small source lexer for the repo's static scans (F-20: moved verbatim from lib/a11y-copy.test.ts so the copy guard
// and the colour-literal scanner (lib/colour-literals.test.ts) share it without importing a test file).
export type Piece = { text: string; at: number };

// A small lexer: string and template literals (static parts), comments blanked, and the remaining code. Regex literals
// are recognised after the usual punctuators so a quote inside one never starts a string.
export function lex(src: string): { literals: Piece[]; code: string } {
  const literals: Piece[] = [];
  const code = src.split('');
  const blank = (a: number, b: number) => { for (let k = a; k < b; k++) if (code[k] !== '\n') code[k] = ' '; };
  let i = 0;
  let last = ''; // last significant code character, for regex detection
  const stack: number[] = []; // brace depth at each open template `${`
  let depth = 0;
  const readTemplate = (start: number, tagged: boolean) => {
    // start is just after the backtick or the closing brace of `${…}`
    let j = start, buf = '', from = start;
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { buf += src[j + 1] ?? ''; j += 2; continue; }
      if (c === '`') { if (!tagged) literals.push({ text: buf, at: from }); blank(start, j); return { end: j + 1, open: false }; }
      if (c === '$' && src[j + 1] === '{') { if (!tagged) literals.push({ text: buf, at: from }); blank(start, j); return { end: j + 2, open: true }; }
      buf += c; j++;
    }
    return { end: j, open: false };
  };
  const tags: boolean[] = [];
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; blank(i, end); i = end; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; blank(i, end); i = end; continue; }
    if (c === '\'' || c === '"') {
      let j = i + 1, buf = '';
      while (j < src.length && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') { buf += src[j + 1]; j += 2; } else buf += src[j++]; }
      literals.push({ text: buf, at: i }); blank(i, j + 1); i = j + 1; last = 'a'; continue;
    }
    if (c === '`') {
      const before = src.slice(Math.max(0, i - 200), i).trimEnd();
      const tagged = /[\w$]$/.test(before) || /[A-Za-z_$][\w$.]*<[^<>()=;]*>$/.test(before); // sql`…` and sql<T>`…`
      const r = readTemplate(i + 1, tagged); blank(i, i + 1);
      if (r.open) { stack.push(depth); tags.push(tagged); depth++; }
      i = r.end; last = 'a'; continue;
    }
    if (c === '/' && /[(,=:[!&|?{};+\-*%~^]|^$/.test(last)) {
      // regex literal
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break;
        j++;
      }
      blank(i, j + 1); i = j + 1; last = 'a'; continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (stack.length && stack[stack.length - 1] === depth) {
        stack.pop(); const tagged = tags.pop()!;
        const r = readTemplate(i + 1, tagged); blank(i, i + 1);
        if (r.open) { stack.push(depth); tags.push(tagged); depth++; }
        i = r.end; last = 'a'; continue;
      }
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return { literals, code: code.join('') };
}

// JSX text: runs of code between `>` or `}` and `<` or `{` that read like prose (no statement punctuation).
// ponytail: a heuristic lexer, not a parser (prose with "=", "&&" or a keyword like "return" is skipped) — swap in a
// real TSX parser if the repo ever gains one with a JS API (TypeScript 7 ships none).
export function jsxText(code: string): Piece[] {
  const out: Piece[] = [];
  for (const m of code.matchAll(/[>}]([^<>{}]*)(?=[<{])/g)) {
    const t = m[1].replace(/&[a-z]+;/g, "'");
    if (!/[A-Za-z]/.test(t) || /=|&&|\|\||\b(export|function|const|let|return|import|interface|await)\b/.test(t)) continue;
    out.push({ text: t, at: m.index! + 1 });
  }
  return out;
}

