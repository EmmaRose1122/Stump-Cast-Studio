/**
 * Tiny DOM builders. Player and team names come from third-party pages, so everything is set
 * through textContent / attributes, never innerHTML.
 */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const row = (...children: (Node | string)[]): HTMLElement => {
  const r = el('div', 'cd-row');
  for (const c of children) r.append(c);
  return r;
};

/** Big number with a small label under it. */
export const stat = (value: string, label: string, className = ''): HTMLElement => {
  const s = el('div', `cd-stat ${className}`.trim());
  s.append(el('span', 'cd-stat-value', value), el('span', 'cd-stat-label', label));
  return s;
};

export const note = (text: string): HTMLElement => el('p', 'cd-note', text);

const SVG_NS = 'http://www.w3.org/2000/svg';

export const svg = (width: number, height: number): SVGSVGElement => {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${width} ${height}`);
  s.setAttribute('width', String(width));
  s.setAttribute('height', String(height));
  s.setAttribute('role', 'img');
  return s;
};

export const svgEl = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
};

export const fixed = (n: number, dp = 2): string => (Number.isFinite(n) ? n.toFixed(dp) : '0.00');

/** Strike rate / economy style division that never prints NaN or Infinity. */
export const per = (num: number, den: number, mult = 1, dp = 2): string =>
  den > 0 ? fixed((num / den) * mult, dp) : fixed(0, dp);
