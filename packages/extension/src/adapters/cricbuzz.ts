import raw from '../config/selectors.cricbuzz.json';
import { SelectorConfigSchema, type SelectorConfig } from './config';
import { createAdapter, type AdapterHandle } from './engine';

/**
 * Bundled selector config. It is intentionally empty until real Cricbuzz fixtures are saved
 * (see fixtures/README.md); remote updates (X5) replace it at runtime.
 */
export const cricbuzzConfig: SelectorConfig = SelectorConfigSchema.parse(raw);

export const createCricbuzzAdapter = (config: SelectorConfig = cricbuzzConfig): AdapterHandle =>
  createAdapter(config);
