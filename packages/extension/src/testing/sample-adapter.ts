import type { RawUpdate } from '@stumpcast/shared';
import type { Adapter } from '../adapter';

/**
 * Throwaway adapter for the SYNTHETIC `fixtures/_sample` page. It exists only to prove the
 * harness works; the real selector-driven adapters arrive in prompt X2.
 */
export const sampleAdapter: Adapter = ({ site, url, document, now }) => {
  const root = document.querySelector<HTMLElement>('[data-sample-score]');
  const num = (name: string) => Number(root?.dataset[name] ?? NaN);
  const runs = num('runs');
  const wkts = num('wkts');
  const missing: string[] = [];
  if (Number.isNaN(runs) || Number.isNaN(wkts)) missing.push('innings');

  const update: RawUpdate = {
    source: site,
    matchId: 'sample-1',
    url,
    capturedAt: now,
    confidence: missing.length ? 0 : 1,
    fields: {
      title: document.querySelector('h1')?.textContent?.trim(),
      teams: [],
      innings: missing.length
        ? []
        : [
            {
              team: root?.dataset.team ?? '',
              runs,
              wkts,
              overs: num('overs'),
              balls: num('balls'),
            },
          ],
      batters: [],
      thisOver: [],
      lastBalls: [],
    },
    missing,
  };
  return update;
};
