import raw from '../config/selectors.crex.json';
import { SelectorConfigSchema, type SelectorConfig } from './config';
import { createAdapter, type AdapterHandle } from './engine';

/** Stub with the same interface as Cricbuzz; real selectors arrive in prompt X7. */
export const crexConfig: SelectorConfig = SelectorConfigSchema.parse(raw);

export const createCrexAdapter = (config: SelectorConfig = crexConfig): AdapterHandle =>
  createAdapter(config);
