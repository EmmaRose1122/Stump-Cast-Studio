// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtures } from '@stumpcast/shared';
import './i18n';
import { contrastRatio } from './lib/contrast';
import type { AlarmState, ProviderStatus } from './lib/api';
import { deriveChips } from './lib/status';
import { QUICK_CARDS, isTypingTarget, resolveShortcut } from './lib/shortcuts';
import { currentPath } from './lib/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Gallery } from './pages/Gallery';
import { SettingsPage } from './pages/pages';
import { AlarmBanner, OnAirIndicator, StatusChip } from './shell/AppShell';
import { applyTheme, useAdmin } from './store';
import { Banner, Button, IconButton, TooltipProvider } from './ui';

// jsdom lacks ResizeObserver, which Radix's slider needs.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  useAdmin.setState({ alarm: null, onAirCard: null, toasts: [] });
});

// ---- contrast (AA) on the real CSS tokens --------------------------------------------------

const css = fs.readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8');
const tokens = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]),
  ) as Record<string, string>;
const dark = tokens(css.slice(css.indexOf('@theme'), css.indexOf(":root[data-theme='light']")));
const light = { ...dark, ...tokens(css.slice(css.indexOf(":root[data-theme='light']"))) };

describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme contrast (WCAG AA 4.5:1)', (_name, t) => {
  const pairs: [string, string][] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['text', 'surface-2'],
    ['muted', 'bg'],
    ['muted', 'surface'],
    ['muted', 'surface-2'],
    ['teal-ink', 'teal'],
    ['coral-ink', 'coral'],
    ['error-ink', 'error'],
    ['teal', 'surface'],
    ['ok', 'surface'],
    ['amber', 'surface'],
    ['error', 'surface'],
  ];
  it.each(pairs)('%s on %s', (fg, bg) => {
    expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});

// ---- shortcuts ----------------------------------------------------------------------------

const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
  resolveShortcut({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: document.body,
    ...extra,
  });

describe('shortcuts', () => {
  it('maps 1-9 to the quick cards', () => {
    expect(QUICK_CARDS).toHaveLength(9);
    expect(key('1')).toEqual({ type: 'card', cardId: QUICK_CARDS[0] });
    expect(key('9')).toEqual({ type: 'card', cardId: QUICK_CARDS[8] });
    expect(key('0')).toBeNull();
  });

  it('Space hides and G opens Graphics', () => {
    expect(key(' ')).toEqual({ type: 'hide' });
    expect(key('g')).toEqual({ type: 'goto', route: '/graphics' });
    expect(key('G')).toEqual({ type: 'goto', route: '/graphics' });
  });

  it('ignores modified keys and typing contexts', () => {
    expect(key('1', { ctrlKey: true })).toBeNull();
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);
    expect(key('1', { target: input })).toBeNull();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const btn = document.createElement('button');
    dialog.appendChild(btn);
    expect(key(' ', { target: btn })).toBeNull();
  });
});

// ---- status chips --------------------------------------------------------------------------

const provider = (over: Partial<ProviderStatus> = {}): ProviderStatus => ({
  health: 'connected',
  lastHeartbeatAt: 1,
  extensionVersion: '0.0.1',
  selectorsVersion: 1,
  matches: [],
  ...over,
});

describe('deriveChips', () => {
  it('shows a healthy extension and the live match', () => {
    const chips = deriveChips({ provider: provider(), matches: [fixtures.t20] });
    expect(chips.map((c) => c.id)).toEqual(['provider', 'match', 'obs', 'licence']);
    expect(chips[0]).toMatchObject({ state: 'ok', value: 'Extension connected' });
    expect(chips[1]).toMatchObject({ state: 'ok' });
  });

  it('maps stale, down, never-connected and offline server', () => {
    expect(deriveChips({ provider: provider({ health: 'stale' }) })[0]!.state).toBe('warn');
    expect(deriveChips({ provider: provider({ health: 'down' }) })[0]!.state).toBe('error');
    expect(deriveChips({ provider: provider({ lastHeartbeatAt: null }) })[0]).toMatchObject({
      state: 'warn',
      value: 'Extension not connected',
    });
    expect(deriveChips({ providerError: true })[0]).toMatchObject({
      state: 'error',
      value: 'Server offline',
    });
  });

  it('lets an active alarm tint a connected provider', () => {
    const alarm: AlarmState = {
      level: 'warn',
      code: 'DATA_STALE',
      message: 'x',
      muted: false,
      since: 1,
    };
    expect(deriveChips({ provider: provider(), alarm })[0]!.state).toBe('warn');
  });

  it('shows live OBS connection state and free licence status', () => {
    const chips = deriveChips({ provider: provider(), matches: [] });
    expect(chips[1]).toMatchObject({ value: 'No match', state: 'neutral' });
    expect(chips[2]).toMatchObject({ value: 'Not connected', state: 'neutral' });
    expect(chips[3]!.value).toBe('Free');
    expect(deriveChips({ provider: provider(), obs: { connected: true, error: null } })[2]).toMatchObject({ value: 'Connected', state: 'ok' });
    expect(deriveChips({ provider: provider(), obs: { connected: false, error: 'bad password' } })[2]).toMatchObject({ value: 'Connection failed', state: 'error' });
  });
});

// ---- components ----------------------------------------------------------------------------

describe('components', () => {
  it('icon buttons expose an accessible name', () => {
    render(<IconButton label="Close">✕</IconButton>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('buttons fire and respect disabled', () => {
    const fn = vi.fn();
    render(
      <>
        <Button onClick={fn}>Go</Button>
        <Button disabled onClick={fn}>
          No
        </Button>
      </>,
    );
    fireEvent.click(screen.getByText('Go'));
    fireEvent.click(screen.getByText('No'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('banners announce errors as alerts', () => {
    render(<Banner tone="error" title="Problem" />);
    expect(screen.getByRole('alert').textContent).toContain('Problem');
  });

  it('status chips carry state for assistive tech', () => {
    render(<StatusChip chip={{ id: 'provider', label: 'Provider', value: 'OK', state: 'ok' }} />);
    expect(screen.getByText('status ok')).toBeTruthy();
  });

  it('ON AIR indicator reflects the active card', () => {
    const { rerender } = render(<OnAirIndicator card={null} />);
    expect(screen.getByRole('status').textContent).toBe('OFF AIR');
    rerender(<OnAirIndicator card="manhattan" />);
    expect(screen.getByRole('status').textContent).toContain('ON AIR');
    expect(screen.getByRole('status').textContent).toContain('manhattan');
  });

  it('alarm banner shows the message and offers to mute', () => {
    useAdmin.setState({
      alarm: {
        level: 'error',
        code: 'PROVIDER_DOWN',
        message: 'Source disconnected',
        muted: false,
        since: 1,
      },
    });
    render(<AlarmBanner />);
    expect(screen.getByText(/Source disconnected/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mute alarm' })).toBeTruthy();
  });

  it('alarm banner is hidden when ok', () => {
    useAdmin.setState({
      alarm: { level: 'ok', code: null, message: '', muted: false, since: null },
    });
    const { container } = render(<AlarmBanner />);
    expect(container.textContent).toBe('');
  });
});

describe('gallery', () => {
  it('renders every component section', () => {
    render(
      <TooltipProvider>
        <Gallery />
      </TooltipProvider>,
    );
    for (const name of [
      'Button',
      'IconButton',
      'Card',
      'Tabs',
      'Switch',
      'Slider',
      'Select',
      'Dialog',
      'Toast',
      'Tooltip',
      'EmptyState',
      'Banner',
      'Status chips',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeTruthy();
    }
  });
});

describe('theme and routing', () => {
  it('applies the theme to the root element', () => {
    const root = document.createElement('html');
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
  });

  it('parses hash routes with a default', () => {
    expect(currentPath('')).toBe('/live');
    expect(currentPath('#/graphics')).toBe('/graphics');
    expect(currentPath('#settings')).toBe('/settings');
  });
});

describe('SettingsPage Data Source & Selectors (Prompt X5)', () => {
  it('renders selectors version and action controls', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <SettingsPage />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/DATA SOURCE & SELECTORS/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /check now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /rollback to bundled/i })).toBeTruthy();
  });
});
