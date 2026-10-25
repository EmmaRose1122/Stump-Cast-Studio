import { useEffect, useState } from 'react';

export const ROUTES = [
  { path: '/live', key: 'nav.live' },
  { path: '/graphics', key: 'nav.graphics' },
  { path: '/pro-look-2', key: 'nav.proLook2' },
  { path: '/video', key: 'nav.video' },
  { path: '/sounds', key: 'nav.sounds' },
  { path: '/players', key: 'nav.players' },
  { path: '/settings', key: 'nav.settings' },
  { path: '/help', key: 'nav.help' },
] as const;

export const currentPath = (hash = window.location.hash): string => {
  const p = hash.replace(/^#/, '') || '/live';
  return p.startsWith('/') ? p : `/${p}`;
};

export const navigate = (path: string): void => {
  window.location.hash = path;
};

/** Minimal hash router: works under any base path (the server mounts us at /admin/). */
export const useRoute = (): string => {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
};
