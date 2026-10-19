/**
 * Minimal path reader: `$.a.b[0].c`, `a.b[0]`, `a["b-c"]`. No filters or wildcards, on purpose,
 * so a selector config can never do anything but read a value.
 */
export const readPath = (root: unknown, path: string): unknown => {
  const tokens: (string | number)[] = [];
  const re = /\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]|([^.[\]]+)/g;
  const p = path.startsWith('$') ? path.slice(1) : path;
  for (let m = re.exec(p); m; m = re.exec(p)) {
    if (m[1] !== undefined) tokens.push(Number(m[1]));
    else tokens.push((m[2] ?? m[3] ?? m[4])!);
  }
  let cur: unknown = root;
  for (const t of tokens) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[t];
    } else {
      if (Array.isArray(cur) || !Object.hasOwn(cur, t)) return undefined;
      cur = (cur as Record<string, unknown>)[t];
    }
  }
  return cur;
};
