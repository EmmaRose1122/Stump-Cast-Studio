import {
  DEFAULT_LOOK,
  createSettings,
  getLook,
  type CardCommand,
  type Look,
  type MatchState,
  type Settings,
} from '@stumpcast/shared';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export interface ActiveCard {
  cardId: string;
  durationSec: number;
  source: 'director' | 'operator';
  data?: Record<string, unknown>;
}

export interface OverlayState {
  /** All matches the server knows about, keyed by id. Never cleared on disconnect. */
  matches: Record<string, MatchState>;
  /** Id of the match being shown (query param, else the most recently updated one). */
  matchId: string | null;
  settings: Settings;
  look: Look;
  /** Cards waiting to be shown, oldest first. */
  queue: ActiveCard[];
  /** Card currently on air. */
  active: ActiveCard | null;
  connection: ConnectionStatus;
  /** Whether a valid licence key is active (hides watermark + popup). */
  licensed: boolean;
}

type Listener = (s: OverlayState, prev: OverlayState) => void;

/** Tiny observable store. State objects are replaced, never mutated. */
export class OverlayStore {
  private state: OverlayState;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly pinnedMatchId: string | null = null) {
    this.state = {
      matches: {},
      matchId: pinnedMatchId,
      settings: createSettings(),
      look: DEFAULT_LOOK,
      queue: [],
      active: null,
      connection: 'connecting',
      licensed: false,
    };
  }

  get(): OverlayState {
    return this.state;
  }

  /** The state of the match on air, or undefined before any data arrived. */
  current(): MatchState | undefined {
    const { matches, matchId } = this.state;
    return matchId ? matches[matchId] : undefined;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<OverlayState>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const fn of this.listeners) fn(this.state, prev);
  }

  setMatch(match: MatchState): void {
    const { matches } = this.state;
    const known = matches[match.id];
    // Ignore out-of-order deliveries so the overlay never steps backwards.
    if (known && Date.parse(known.updatedAt) > Date.parse(match.updatedAt)) return;

    // Determine which match to show:
    // 1. If URL pins a match, use that.
    // 2. If operator set onStreamMatchId in settings, follow that.
    // 3. Otherwise keep current, or fall back to this match if nothing is selected yet.
    // Which ids are real is the server's call — the overlay renders whatever it is fed.
    const onStreamId = this.state.settings?.onStreamMatchId;
    let matchId: string | null;
    if (this.pinnedMatchId) {
      matchId = this.pinnedMatchId;
    } else if (onStreamId) {
      matchId = onStreamId;
    } else if (this.state.matchId) {
      matchId = this.state.matchId;
    } else {
      matchId = match.id;
    }

    this.set({ matches: { ...matches, [match.id]: match }, matchId });
  }

  setMatches(list: MatchState[]): void {
    for (const m of list) this.setMatch(m);
  }

  selectMatch(id: string | null): void {
    if (!this.pinnedMatchId) this.set({ matchId: id });
  }

  setSettings(settings: Settings): void {
    // The operator's "put on stream" choice wins unless the URL pins a match.
    const matchId =
      !this.pinnedMatchId && settings.onStreamMatchId
        ? settings.onStreamMatchId
        : this.state.matchId;
    const patch: Partial<OverlayState> = { settings, matchId };
    if (settings.theme && settings.theme !== this.state.look.id) {
      const l = getLook(settings.theme);
      if (l) patch.look = l;
    }
    this.set(patch);
  }

  setLook(look: Look): void {
    this.set({ look });
  }

  setConnection(connection: ConnectionStatus): void {
    if (connection !== this.state.connection) this.set({ connection });
  }

  setLicensed(licensed: boolean): void {
    if (licensed !== this.state.licensed) this.set({ licensed });
  }

  /** Apply a `cards` channel command. A new `show` replaces the card on air. */
  applyCard(cmd: CardCommand): void {
    if (cmd.action === 'show') {
      const card: ActiveCard = {
        cardId: cmd.cardId,
        durationSec: cmd.durationSec,
        source: cmd.source,
        data: cmd.data,
      };
      this.set({ active: card });
    } else if (cmd.action === 'hide') {
      if (!cmd.cardId || this.state.active?.cardId === cmd.cardId) this.set({ active: null });
    }
  }
}
