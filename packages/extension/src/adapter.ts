import type { RawUpdate, SourceSite } from '@stumpcast/shared';

/** A page JSON/XHR response the page itself fetched, as observed (never fetched by us). */
export interface TapResponse {
  url: string;
  json: unknown;
}

export interface AdapterInput {
  site: SourceSite;
  url: string;
  document: Document;
  taps: TapResponse[];
  /** Injected so output is deterministic in tests. */
  now: number;
}

/** An adapter turns a captured page into a RawUpdate. It must never throw to the caller. */
export type Adapter = (input: AdapterInput) => RawUpdate;
