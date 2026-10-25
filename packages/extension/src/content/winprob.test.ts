import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractWinProbFromDom } from './winprob';

describe('extractWinProbFromDom', () => {
  it('extracts win probability from Cricbuzz style win predictor widget', () => {
    const html = `
      <div class="cb-win-prb">
        <div class="cb-mat-pred">Win Predictor</div>
        <div class="cb-col cb-col-100 cb-zz-rt-scrs">
          <span class="team-name">India</span>
          <span class="cb-wp-per">72%</span>
          <div class="cb-wp-bar"><div style="width: 72%;"></div></div>
          <span class="cb-wp-per">28%</span>
          <span class="team-name">Pakistan</span>
        </div>
      </div>
    `;
    const dom = new JSDOM(html);
    const result = extractWinProbFromDom(dom.window.document, [
      { name: 'India', short: 'IND' },
      { name: 'Pakistan', short: 'PAK' },
    ]);
    expect(result).toBeDefined();
    expect(result!.teamA).toBe(0.72);
    expect(result!.teamB).toBe(0.28);
  });

  it('extracts win probability when team 2 is listed first', () => {
    const html = `
      <div class="win-predictor-container">
        <span class="title">Win Probability</span>
        <div class="teams-wrap">
          <span class="team">England 60%</span>
          <span class="team">Australia 40%</span>
        </div>
      </div>
    `;
    const dom = new JSDOM(html);
    const result = extractWinProbFromDom(dom.window.document, [
      { name: 'Australia', short: 'AUS' },
      { name: 'England', short: 'ENG' },
    ]);
    expect(result).toBeDefined();
    expect(result!.teamA).toBe(0.4);
    expect(result!.teamB).toBe(0.6);
  });

  it('extracts win probability from progress bar width style', () => {
    const html = `
      <div class="match-predictor">
        <div class="header">WIN CHANCE</div>
        <div class="predictor-bar">
          <div class="bar-fill" style="width: 65.5%;"></div>
        </div>
      </div>
    `;
    const dom = new JSDOM(html);
    const result = extractWinProbFromDom(dom.window.document, [
      { name: 'New Zealand', short: 'NZ' },
      { name: 'South Africa', short: 'SA' },
    ]);
    expect(result).toBeDefined();
    expect(result!.teamA).toBe(0.655);
    expect(result!.teamB).toBe(0.345);
  });

  it('returns undefined if no predictor elements or percentages exist', () => {
    const html = `<div><h1>Match Live</h1><p>Scores are level</p></div>`;
    const dom = new JSDOM(html);
    const result = extractWinProbFromDom(dom.window.document, [
      { name: 'India', short: 'IND' },
      { name: 'Australia', short: 'AUS' },
    ]);
    expect(result).toBeUndefined();
  });
});
