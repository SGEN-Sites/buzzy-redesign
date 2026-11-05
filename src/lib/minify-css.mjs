// minify-css.mjs - the build ships stylesheets minified; src/styles stays commented and readable.
// Conservative by design: comments are dropped, whitespace runs collapse to one space, and the space is removed only
// next to { } ; , > and after ':' (never before ':', so ".a :hover" keeps its descendant space; never around + - ( ),
// so calc() and "and (" survive). Quoted strings are copied as they are, and "}" eats a trailing ";".
// tmp/main/css-equiv.mjs parses every source sheet and its minified copy in Chrome and compares the rules.
export function minifyCss(css) {
  let out = '';
  for (let i = 0; i < css.length; ) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1); i = j + 1; continue;
    }
    if (/\s/.test(c) || (c === '/' && css[i + 1] === '*')) {
      while (i < css.length) {
        if (/\s/.test(css[i])) { i++; continue; }
        if (css[i] === '/' && css[i + 1] === '*') { const j = css.indexOf('*/', i + 2); i = j < 0 ? css.length : j + 2; continue; }
        break;
      }
      const prev = out[out.length - 1] || '', next = css[i] || '';
      if (prev && next && !'{};,>:'.includes(prev) && !'{};,>'.includes(next)) out += ' ';
      continue;
    }
    if (c === '}' && out.endsWith(';')) out = out.slice(0, -1);
    out += c; i++;
  }
  return out + '\n';
}
