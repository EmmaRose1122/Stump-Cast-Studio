import { z } from 'zod';
import type { EngineEvent } from './event';
import type { MatchState } from './match';

export const CommentaryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoEvents: z.boolean().default(true),
  voice: z.string().default('default'),
  rate: z.number().min(0.5).max(2).default(1.0),
  pitch: z.number().min(0.5).max(2).default(1.0),
  volume: z.number().min(0).max(1).default(1.0),
});
export type CommentaryConfig = z.infer<typeof CommentaryConfigSchema>;

export const CommentaryItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  eventType: z.string().optional(),
  timestamp: z.number(),
});
export type CommentaryItem = z.infer<typeof CommentaryItemSchema>;

/**
 * Builds realistic, broadcast-style cricket commentary lines for match events.
 */
export function buildEventCommentary(event: EngineEvent, state?: MatchState): string {
  const p = event.payload as Record<string, unknown>;
  const batterName = String(
    p.batter ??
      p.batterName ??
      (Array.isArray(state?.batters) ? state.batters.find((b) => b?.onStrike)?.name : undefined) ??
      'The batter',
  );
  const bowlerName = String(p.bowler ?? p.bowlerName ?? state?.bowler?.name ?? 'The bowler');
  const runs = p.runs !== undefined ? String(p.runs) : '';

  switch (event.type) {
    case 'FOUR': {
      const templates = [
        `Cracking shot! ${batterName} pierces the gap with superb timing for FOUR!`,
        `Driven with elegance by ${batterName}! The ball races away across the turf for FOUR!`,
        `FOUR runs! Smashed firmly off the back foot by ${batterName}!`,
      ];
      return templates[Math.floor(Math.random() * templates.length)] ?? templates[0]!;
    }
    case 'SIX': {
      const templates = [
        `Huge hit! ${batterName} launches it into orbit! That is a monstrous SIX!`,
        `Maximum! Clean as a whistle over deep mid-wicket from ${batterName} for SIX!`,
        `All the way from ${batterName}! That has cleared the ropes with absolute authority, SIX runs!`,
      ];
      return templates[Math.floor(Math.random() * templates.length)] ?? templates[0]!;
    }
    case 'WICKET': {
      const dismissal = p.how ? `out ${p.how}` : 'dismissed';
      return `OUT! Huge moment in the match! ${batterName} is ${dismissal}! Brilliant bowling from ${bowlerName}!`;
    }
    case 'FIFTY': {
      return `Fifty up! A brilliant half-century for ${batterName}! A high-class, composed innings!`;
    }
    case 'HUNDRED': {
      return `What a sensational milestone! A magnificent century for ${batterName}! The entire ground stands to applaud!`;
    }
    case 'OVER_END': {
      const overNum = p.over !== undefined ? p.over : state ? state.score.overs : '';
      const totalRuns = state?.score?.runs ?? runs;
      const totalWkts = state?.score?.wkts ?? '';
      if (overNum && totalRuns !== '') {
        return `End of over ${overNum}. The score moves to ${totalRuns} for ${totalWkts}.`;
      }
      return `End of the over from ${bowlerName}.`;
    }
    case 'MILESTONE': {
      const msg = p.message ? String(p.message) : `${batterName} reaches a key milestone!`;
      return `Milestone reached! ${msg}`;
    }
    case 'DRS': {
      return `Review taken! The decision is referred upstairs to the third umpire.`;
    }
    case 'INNINGS_END': {
      return `That is the end of the innings! Both teams head off as the players prepare for the chase.`;
    }
    default:
      return p.text ? String(p.text) : `${event.type} in play.`;
  }
}
