export interface TeamRef {
  name: string;
  short?: string;
}

export interface WinProbEstimate {
  teamA: number;
  teamB: number;
}

const norm = (s: string | undefined): string =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Extracts live win probability percentages from Cricbuzz or Crex DOM elements.
 * Returns normalized { teamA, teamB } (where teamA is teams[0] and teamB is teams[1])
 * or undefined if the page does not display a win prediction widget.
 */
export const extractWinProbFromDom = (
  doc: Document,
  teams: TeamRef[],
): WinProbEstimate | undefined => {
  if (!teams || teams.length < 2) return undefined;

  const t1Names = [norm(teams[0]?.name), norm(teams[0]?.short)].filter(Boolean);
  const t2Names = [norm(teams[1]?.name), norm(teams[1]?.short)].filter(Boolean);

  // 1. Look for targeted predictor containers
  const selectors = [
    '[class*="predictor"]',
    '[class*="win-pred"]',
    '[class*="win_pred"]',
    '[class*="win-prob"]',
    '[class*="win_prob"]',
    '[class*="win-per"]',
    '[class*="winPredict"]',
    '[class*="winProb"]',
    '[class*="winPercent"]',
    '[class*="win-bar"]',
    '[class*="cb-mat-pred"]',
    '.cb-win-prb',
    '.cb-wp-box',
    '#miniscore-branding-container',
  ];

  const candidateElements: Element[] = [];

  for (const sel of selectors) {
    try {
      const els = doc.querySelectorAll(sel);
      for (const el of els) candidateElements.push(el);
    } catch {
      // Ignore selector errors
    }
  }

  // Also search for elements containing explicit "Win Predictor", "Win %", or "Win Chance" text
  try {
    const all = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, span, div, p, strong, b');
    for (const el of all) {
      if (el.children.length <= 3 && /win\s*(?:predictor|probability|prediction|%|chance)/i.test(el.textContent ?? '')) {
        candidateElements.push(el);
      }
    }
  } catch {
    // Fallback
  }

  // Helper to extract percentages from a container
  const parseFromContainer = (container: Element): WinProbEstimate | undefined => {
    const text = container.textContent ?? '';

    // Check for explicit percentage matches: e.g. "68%" and "32%"
    const matches = Array.from(text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g));
    let p1: number | undefined;
    let p2: number | undefined;

    if (matches.length >= 2) {
      const v1 = parseFloat(matches[0]![1]!);
      const v2 = parseFloat(matches[1]![1]!);
      if (!Number.isNaN(v1) && !Number.isNaN(v2) && v1 + v2 >= 95 && v1 + v2 <= 105) {
        p1 = v1;
        p2 = v2;
      }
    }

    // Check for progress bar inline style widths: style="width: 65%"
    if (p1 === undefined) {
      const barElements = container.querySelectorAll('[style*="width"]');
      for (const bar of barElements) {
        const style = bar.getAttribute('style') ?? '';
        const widthMatch = /width:\s*(\d{1,2}(?:\.\d+)?)\s*%/i.exec(style);
        if (widthMatch) {
          const w = parseFloat(widthMatch[1]!);
          if (!Number.isNaN(w) && w >= 1 && w <= 99) {
            p1 = w;
            p2 = 100 - w;
            break;
          }
        }
      }
    }

    if (p1 === undefined || p2 === undefined) return undefined;

    // Determine team association
    // Inspect whether team 2 is mentioned before team 1, or closer to p1
    const lowerText = norm(text);
    const pos1 = Math.min(...t1Names.map((n) => lowerText.indexOf(n)).filter((idx) => idx >= 0));
    const pos2 = Math.min(...t2Names.map((n) => lowerText.indexOf(n)).filter((idx) => idx >= 0));

    let team1Pct = p1;
    let team2Pct = p2;

    if (pos2 >= 0 && (pos1 < 0 || pos2 < pos1)) {
      // Team 2 is listed first in this container
      team1Pct = p2;
      team2Pct = p1;
    }

    const total = team1Pct + team2Pct;
    if (total <= 0) return undefined;

    const normA = Math.round((team1Pct / total) * 1000) / 1000;
    const normB = Math.round((1 - normA) * 1000) / 1000;

    return { teamA: normA, teamB: normB };
  };

  // Evaluate candidate containers and their parents (up to 2 levels)
  for (const el of candidateElements) {
    let curr: Element | null = el;
    for (let depth = 0; curr && depth < 3; depth++) {
      const res = parseFromContainer(curr);
      if (res) return res;
      curr = curr.parentElement;
    }
  }

  return undefined;
};
