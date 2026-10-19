import { create } from 'zustand';
import type { AlarmState } from './lib/api';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'stumpcast.theme';

export const readTheme = (): Theme => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage unavailable */
  }
  return 'light';
};

export const applyTheme = (theme: Theme, root: HTMLElement = document.documentElement): void => {
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
};

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  kind: 'info' | 'success' | 'error';
}

interface AdminState {
  theme: Theme;
  setTheme(t: Theme): void;

  /** Latest watchdog alarm (pushed over the health channel). */
  alarm: AlarmState | null;
  setAlarm(a: AlarmState): void;

  /** Card currently on air (from the cards channel); drives the ON AIR indicator. */
  onAirCard: string | null;
  setOnAirCard(id: string | null): void;

  wsConnected: boolean;
  setWsConnected(v: boolean): void;

  toasts: ToastItem[];
  toast(t: Omit<ToastItem, 'id' | 'kind'> & { kind?: ToastItem['kind'] }): void;
  dismissToast(id: number): void;
}

let toastId = 1;

export const useAdmin = create<AdminState>((set) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  alarm: null,
  setAlarm: (alarm) => set({ alarm }),

  onAirCard: null,
  setOnAirCard: (onAirCard) => set({ onAirCard }),

  wsConnected: false,
  setWsConnected: (wsConnected) => set({ wsConnected }),

  toasts: [],
  toast: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: toastId++, kind: t.kind ?? 'info', title: t.title, description: t.description },
      ],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
