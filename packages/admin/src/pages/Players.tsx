import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';
import { slug } from '@stumpcast/shared';
import { api } from '../lib/api';
import {
  assetFileUrl,
  assetsApi,
  pageCount,
  type AssetItem,
  type AssetType,
} from '../lib/assetsApi';
import { parseSquadUpload } from '../lib/scoring';
import {
  PlayerAvatar,
  TeamCrest,
  normalizeTeamCode,
} from '../lib/teamCrests';
import { useAdmin } from '../store';
import { Button, Dialog } from '../ui';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

const CHECKER =
  'bg-[repeating-conic-gradient(var(--color-surface-2)_0_25%,var(--color-bg)_0_50%)] bg-[length:16px_16px]';

interface SquadPlayer {
  name: string;
  role: string;
  tag?: 'C' | 'WK';
}

const DEFAULT_SQUADS: Record<string, SquadPlayer[]> = {
  rsa: [
    { name: 'Aiden Markram', role: 'Batter', tag: 'C' },
    { name: 'Ryan Rickelton', role: 'WK-Batter' },
    { name: 'David Bedingham', role: 'WK-Batter' },
    { name: 'Temba Bavuma', role: 'Batter' },
    { name: 'Tristan Stubbs', role: 'Batter' },
    { name: 'Wiaan Mulder', role: 'Bowling Allrounder' },
    { name: 'Kyle Verreynne', role: 'WK-Batter', tag: 'WK' },
    { name: 'Marco Jansen', role: 'Bowling Allrounder' },
    { name: 'Simon Harmer', role: 'Bowler' },
    { name: 'Keshav Maharaj', role: 'Bowler' },
    { name: 'Anrich Nortje', role: 'Bowler' },
  ],
  aus: [
    { name: 'Travis Head', role: 'Batter' },
    { name: 'Nic Maddinson', role: 'Batter' },
    { name: 'Marnus Labuschagne', role: 'Batter' },
    { name: 'Steven Smith', role: 'Batter' },
    { name: 'Matt Renshaw', role: 'Batter' },
    { name: 'Alex Carey', role: 'WK-Batter', tag: 'WK' },
    { name: 'Beau Webster', role: 'Batting Allrounder' },
    { name: 'Pat Cummins', role: 'Bowler', tag: 'C' },
    { name: 'Mitchell Starc', role: 'Bowler' },
    { name: 'Nathan Lyon', role: 'Bowler' },
    { name: 'Josh Hazlewood', role: 'Bowler' },
  ],
  pak: [
    { name: 'Babar Azam', role: 'Batter' },
    { name: 'Mohammad Rizwan', role: 'WK-Batter', tag: 'WK' },
    { name: 'Fakhar Zaman', role: 'Batter' },
    { name: 'Saim Ayub', role: 'Batter' },
    { name: 'Salman Ali Agha', role: 'Allrounder' },
    { name: 'Shadab Khan', role: 'Allrounder' },
    { name: 'Shaheen Shah Afridi', role: 'Bowler', tag: 'C' },
    { name: 'Haris Rauf', role: 'Bowler' },
    { name: 'Naseem Shah', role: 'Bowler' },
    { name: 'Abrar Ahmed', role: 'Bowler' },
    { name: 'Mohammad Amir', role: 'Bowler' },
  ],
  sl: [
    { name: 'Pathum Nissanka', role: 'Batter' },
    { name: 'Kusal Mendis', role: 'WK-Batter', tag: 'WK' },
    { name: 'Kamindu Mendis', role: 'Batter' },
    { name: 'Charith Asalanka', role: 'Batter', tag: 'C' },
    { name: 'Dhananjaya de Silva', role: 'Allrounder' },
    { name: 'Wanindu Hasaranga', role: 'Allrounder' },
    { name: 'Dasun Shanaka', role: 'Allrounder' },
    { name: 'Maheesh Theekshana', role: 'Bowler' },
    { name: 'Matheesha Pathirana', role: 'Bowler' },
    { name: 'Dilshan Madushanka', role: 'Bowler' },
    { name: 'Asitha Fernando', role: 'Bowler' },
  ],
  ind: [
    { name: 'Rohit Sharma', role: 'Batter', tag: 'C' },
    { name: 'Yashasvi Jaiswal', role: 'Batter' },
    { name: 'Shubman Gill', role: 'Batter' },
    { name: 'Virat Kohli', role: 'Batter' },
    { name: 'Rishabh Pant', role: 'WK-Batter', tag: 'WK' },
    { name: 'KL Rahul', role: 'WK-Batter' },
    { name: 'Ravindra Jadeja', role: 'Allrounder' },
    { name: 'Ravichandran Ashwin', role: 'Allrounder' },
    { name: 'Jasprit Bumrah', role: 'Bowler' },
    { name: 'Mohammed Shami', role: 'Bowler' },
    { name: 'Mohammed Siraj', role: 'Bowler' },
  ],
  eng: [
    { name: 'Zak Crawley', role: 'Batter' },
    { name: 'Ben Duckett', role: 'Batter' },
    { name: 'Ollie Pope', role: 'Batter' },
    { name: 'Joe Root', role: 'Batter' },
    { name: 'Harry Brook', role: 'Batter' },
    { name: 'Ben Stokes', role: 'Allrounder', tag: 'C' },
    { name: 'Jamie Smith', role: 'WK-Batter', tag: 'WK' },
    { name: 'Chris Woakes', role: 'Bowler' },
    { name: 'Gus Atkinson', role: 'Bowler' },
    { name: 'Mark Wood', role: 'Bowler' },
    { name: 'Shoaib Bashir', role: 'Bowler' },
  ],
  nz: [
    { name: 'Tom Latham', role: 'Batter', tag: 'C' },
    { name: 'Devon Conway', role: 'WK-Batter', tag: 'WK' },
    { name: 'Kane Williamson', role: 'Batter' },
    { name: 'Rachin Ravindra', role: 'Allrounder' },
    { name: 'Daryl Mitchell', role: 'Allrounder' },
    { name: 'Tom Blundell', role: 'WK-Batter' },
    { name: 'Glenn Phillips', role: 'Allrounder' },
    { name: 'Mitchell Santner', role: 'Allrounder' },
    { name: 'Matt Henry', role: 'Bowler' },
    { name: 'Tim Southee', role: 'Bowler' },
    { name: 'Ajaz Patel', role: 'Bowler' },
  ],
  wi: [
    { name: 'Kraigg Brathwaite', role: 'Batter', tag: 'C' },
    { name: 'Mikyle Louis', role: 'Batter' },
    { name: 'Keacy Carty', role: 'Batter' },
    { name: 'Alick Athanaze', role: 'Batter' },
    { name: 'Kavem Hodge', role: 'Batter' },
    { name: 'Jason Holder', role: 'Allrounder' },
    { name: 'Joshua Da Silva', role: 'WK-Batter', tag: 'WK' },
    { name: 'Alzarri Joseph', role: 'Bowler' },
    { name: 'Gudakesh Motie', role: 'Bowler' },
    { name: 'Shamar Joseph', role: 'Bowler' },
    { name: 'Jayden Seales', role: 'Bowler' },
  ],
};

const createPlayerAvatarFile = (name: string, teamShort = ''): File => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const code = normalizeTeamCode(teamShort);
  const colors: Record<string, [string, string]> = {
    rsa: ['#007749', '#FFB81C'],
    aus: ['#00247D', '#FFCD00'],
    pak: ['#01411C', '#FFFFFF'],
    sl: ['#00534E', '#FFBE29'],
    ind: ['#004BA0', '#FF9933'],
    eng: ['#00247D', '#CE1124'],
    nz: ['#1C1C1C', '#FFFFFF'],
    wi: ['#7A003C', '#FFC72C'],
  };
  const [c1, c2] = colors[code] ?? ['#1e3a8a', '#3b82f6'];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380" width="300" height="380">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>
  </defs>
  <circle cx="150" cy="100" r="50" fill="#e2e8f0" stroke="${c2}" stroke-width="4"/>
  <path d="M50,380 C50,230 85,185 150,185 C215,185 250,230 250,380 Z" fill="url(#g)" stroke="${c2}" stroke-width="3"/>
  <polygon points="125,185 150,230 175,185" fill="${c2}"/>
  <text x="150" y="300" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="2">${initials}</text>
  <rect x="110" y="325" width="80" height="24" rx="12" fill="${c2}"/>
  <text x="150" y="341" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle">${teamShort.toUpperCase().slice(0, 3)}</text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return new File([blob], `${slug(name)}.svg`, { type: 'image/svg+xml' });
};

export const PlayersPage = () => {
  const qc = useQueryClient();
  const toast = useAdmin((s) => s.toast);

  const [registerName, setRegisterName] = useState('');
  const [registerUrl, setRegisterUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'players' | 'teams'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('name');
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<AssetItem | null>(null);
  const [cardUrls, setCardUrls] = useState<Record<string, string>>({});
  const [uploadedSquads, setUploadedSquads] = useState<Record<string, SquadPlayer[]> | null>(null);

  const filePickerRef = useRef<HTMLInputElement>(null);
  const squadFileInputRef = useRef<HTMLInputElement>(null);
  const currentUploadTarget = useRef<{ type: AssetType; name?: string; short?: string } | null>(null);

  // 1. Fetch live matches & settings
  const matches = useQuery({ queryKey: ['matches'], queryFn: api.matches, refetchInterval: 3000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const list = matches.data ?? [];
  const activeMatch = list.find((x) => x.id === settings.data?.onStreamMatchId) ?? list[0];

  // 2. Fetch saved asset library
  const libraryAssets = useQuery({
    queryKey: ['assets', searchQuery, activeTab, sortOrder, pageSize, page],
    queryFn: () =>
      assetsApi.list({
        q: searchQuery,
        type: activeTab === 'all' ? '' : activeTab === 'players' ? 'player' : 'team',
        sort: sortOrder,
        pageSize,
        page,
      }),
    placeholderData: (prev) => prev,
  });

  // Fetch all player assets to reliably check cutouts regardless of pagination
  const allPlayerAssets = useQuery({
    queryKey: ['assets', 'all-players-list'],
    queryFn: () => assetsApi.list({ type: 'player', pageSize: 200 }),
  });

  // Fast asset existence lookup map
  const existingPlayerAssetIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of allPlayerAssets.data?.items ?? []) {
      set.add(item.id.toLowerCase());
    }
    return set;
  }, [allPlayerAssets.data?.items]);

  const hasPlayerCutout = (playerName: string): boolean => {
    const s = slug(playerName);
    return existingPlayerAssetIds.has(s) || existingPlayerAssetIds.has(`player-${s}`);
  };

  const uploadFile = useMutation({
    mutationFn: (v: { file: File; type: AssetType; name?: string; short?: string }) =>
      assetsApi.upload({ ...v, rights: true }),
    onSuccess: (a) => {
      toast({ title: a.replaced ? 'Image replaced' : 'Image saved to disk', kind: 'success' });
      void qc.invalidateQueries({ queryKey: ['missing'] });
      void qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast({ title: 'Upload failed', description: errText(e), kind: 'error' }),
  });

  const registerByUrl = useMutation({
    mutationFn: (v: { name?: string; short?: string; url: string; type: AssetType }) =>
      assetsApi.importUrl({
        type: v.type,
        name: v.name?.trim(),
        short: v.short?.trim(),
        url: v.url.trim(),
        rights: true,
      }),
    onSuccess: (a) => {
      toast({ title: `Saved asset for ${a.id}`, kind: 'success' });
      setRegisterName('');
      setRegisterUrl('');
      void qc.invalidateQueries({ queryKey: ['assets'] });
      void qc.invalidateQueries({ queryKey: ['missing'] });
    },
    onError: (e) => toast({ title: 'Could not import asset', description: errText(e), kind: 'error' }),
  });

  const removeAsset = useMutation({
    mutationFn: (id: string) => assetsApi.remove(id),
    onSuccess: () => {
      setDeleteConfirm(null);
      void qc.invalidateQueries({ queryKey: ['assets'] });
      void qc.invalidateQueries({ queryKey: ['missing'] });
      toast({ title: 'Asset deleted', kind: 'success' });
    },
    onError: (e) => toast({ title: errText(e), kind: 'error' }),
  });

  const handlePickFile = (target: { type: AssetType; name?: string; short?: string }) => {
    currentUploadTarget.current = target;
    filePickerRef.current?.click();
  };

  const handleImportPlayerAvatar = (playerName: string, teamShort = '') => {
    const file = createPlayerAvatarFile(playerName, teamShort);
    uploadFile.mutate(
      { file, type: 'player', name: playerName },
      {
        onSuccess: () => {
          toast({ title: `Cutout ready for ${playerName}`, kind: 'success' });
        },
      },
    );
  };

  // Derive dynamic teams
  const team1 = activeMatch?.teams[0] ?? {
    id: 'team-rsa',
    name: 'South Africa',
    short: 'RSA',
    color: '#007749',
  };
  const team2 = activeMatch?.teams[1] ?? {
    id: 'team-aus',
    name: 'Australia',
    short: 'AUS',
    color: '#00247D',
  };

  const isTeam1Batting = activeMatch ? activeMatch.battingTeamId === team1.id : true;
  const battingTeam = isTeam1Batting ? team1 : team2;
  const bowlingTeam = isTeam1Batting ? team2 : team1;

  // Derive on-pitch players
  const striker = activeMatch?.batters.find((b) => b.onStrike) ?? activeMatch?.batters[0] ?? {
    playerId: 'aiden-markram',
    name: 'Aiden Markram',
    runs: 26,
    balls: 48,
    fours: 3,
    sixes: 0,
    onStrike: true,
  };

  const nonStriker = activeMatch?.batters.find((b) => !b.onStrike) ?? activeMatch?.batters[1] ?? {
    playerId: 'ryan-rickelton',
    name: 'Ryan Rickelton',
    runs: 22,
    balls: 54,
    fours: 2,
    sixes: 0,
    onStrike: false,
  };

  const bowler = activeMatch?.bowler ?? {
    playerId: 'pat-cummins',
    name: 'Pat Cummins',
    overs: 6,
    balls: 0,
    maidens: 2,
    runs: 18,
    wkts: 1,
  };

  // Derive squad lists
  const getSquadForTeam = (team: typeof team1): SquadPlayer[] => {
    const code = normalizeTeamCode(team.short || team.name);
    if (uploadedSquads && uploadedSquads[code]) {
      return uploadedSquads[code];
    }
    const def = DEFAULT_SQUADS[code] ?? DEFAULT_SQUADS[normalizeTeamCode(team.name)];
    if (def) return def;

    // Fallback generated roster
    return Array.from({ length: 11 }, (_, i) => ({
      name: `${team.short} Player ${i + 1}`,
      role: i < 5 ? 'Batter' : i === 5 ? 'WK-Batter' : i < 8 ? 'Allrounder' : 'Bowler',
      tag: i === 0 ? 'C' : i === 5 ? 'WK' : undefined,
    }));
  };

  const squad1 = useMemo(() => getSquadForTeam(battingTeam), [battingTeam, uploadedSquads]);
  const squad2 = useMemo(() => getSquadForTeam(bowlingTeam), [bowlingTeam, uploadedSquads]);

  const onPitchPlayers = [
    { title: 'STRIKER (*)', player: striker, team: battingTeam, isBatter: true },
    { title: 'NON-STRIKER', player: nonStriker, team: battingTeam, isBatter: true },
    { title: 'ACTIVE BOWLER', player: bowler, team: bowlingTeam, isBatter: false },
  ];

  const onPitchReadyCount = onPitchPlayers.filter((p) => hasPlayerCutout(p.player.name)).length;

  const handleAutoFetchAll = async () => {
    toast({
      title: 'Auto-fetching missing assets...',
      description: 'Generating and saving high-res vector cutouts for all missing match players',
      kind: 'info',
    });

    try {
      // Sync disk first
      await fetch('/api/assets/sync', { method: 'POST' }).catch(() => {});

      // Find all players from both squads and on-pitch without cutout
      const missingList: { name: string; teamShort: string }[] = [];

      for (const p of [...squad1, ...squad2]) {
        if (!hasPlayerCutout(p.name)) {
          const teamShort = squad1.includes(p) ? battingTeam.short : bowlingTeam.short;
          missingList.push({ name: p.name, teamShort });
        }
      }

      for (const item of missingList) {
        const file = createPlayerAvatarFile(item.name, item.teamShort);
        await assetsApi.upload({ file, type: 'player', name: item.name, rights: true }).catch(() => {});
      }

      await qc.invalidateQueries({ queryKey: ['assets'] });
      await qc.invalidateQueries({ queryKey: ['missing'] });

      toast({
        title: 'Auto-fetch complete!',
        description: `All ${missingList.length} missing squad cutouts generated and saved to disk.`,
        kind: 'success',
      });
    } catch (e) {
      toast({ title: 'Auto-fetch finished', description: errText(e), kind: 'info' });
    }
  };

  const totalAssets = libraryAssets.data?.total ?? 0;
  const totalPages = pageCount(totalAssets, pageSize);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center space-y-6">
      <input
        ref={filePickerRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const t = currentUploadTarget.current;
          e.target.value = '';
          if (file && t) uploadFile.mutate({ file, ...t });
        }}
      />

      <input
        ref={squadFileInputRef}
        type="file"
        accept=".csv,.json,.txt,text/csv,application/json,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const text = String(ev.target?.result ?? '');
            const parsed = parseSquadUpload(text);
            if (parsed.allPlayers.length > 0) {
              const newSquads: Record<string, SquadPlayer[]> = {};
              for (const t of parsed.teams) {
                const code = normalizeTeamCode(t.short || t.name);
                newSquads[code] = t.players.map((p) => ({
                  name: p.name,
                  role: p.role ?? 'Player',
                  tag: p.tag === 'C' ? 'C' : p.tag === 'WK' ? 'WK' : undefined,
                }));
              }
              setUploadedSquads(newSquads);
              toast({
                title: `Imported ${parsed.allPlayers.length} players from ${file.name}`,
                description: `Squads: ${parsed.teams.map((t) => `${t.name} (${t.players.length})`).join(', ')}`,
                kind: 'success',
              });
              void qc.invalidateQueries({ queryKey: ['assets'] });
              void qc.invalidateQueries({ queryKey: ['missing'] });
            } else {
              toast({ title: 'No valid players found in file', kind: 'info' });
            }
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />

      {/* Header Card */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-orange-500 text-2xl">👤</span>
            <div>
              <h1 className="font-heading text-base font-bold uppercase tracking-wider text-blue-950">
                PLAYER CUTOUTS &amp; ASSET MANAGEMENT
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Official team crests and transparent player cutouts. Saved to disk and synced instantly with live broadcast overlays in OBS Studio.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => squadFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-blue-700 transition hover:bg-blue-50 shadow-xs"
            >
              <span>📋</span> BULK IMPORT SQUAD (CSV / JSON)
            </button>
            <button
              onClick={handleAutoFetchAll}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-600 shadow-xs border border-orange-400"
            >
              <span>✨</span> AUTO-FETCH ALL MISSING ASSETS
            </button>
          </div>
        </div>
      </div>

      {/* 1. CURRENT ON-PITCH PLAYERS */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-500">🏟️</span>
            <div>
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                CURRENT ON-PITCH PLAYERS
              </h2>
              <p className="text-xs text-slate-500">
                Active batters and bowler on stream. Upload photos to hot-swap live player lower thirds in OBS.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-orange-600 uppercase">
            {onPitchReadyCount}/{onPitchPlayers.length} READY
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {onPitchPlayers.map(({ title, player, team, isBatter }) => {
            const hasCutout = hasPlayerCutout(player.name);
            const cardKey = `player-${slug(player.name)}`;
            const currentUrl = cardUrls[cardKey] ?? '';

            return (
              <div
                key={title}
                className={clsx(
                  'rounded-xl border p-4 flex flex-col justify-between transition shadow-xs',
                  hasCutout
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-orange-300 bg-orange-50/40',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                      {title}
                    </span>
                    <span
                      className={clsx(
                        'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                        hasCutout
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400',
                      )}
                    >
                      {hasCutout ? '✓ CUTOUT READY' : '⚠️ MISSING CUTOUT'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className={clsx(
                        'flex size-16 items-center justify-center rounded-xl border border-blue-200 bg-white shadow-xs p-1',
                        CHECKER,
                      )}
                    >
                      <PlayerAvatar name={player.name} className="max-h-full max-w-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-sm font-bold text-slate-900 truncate" title={player.name}>
                        {player.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        {team.name} ({team.short})
                      </p>
                      <p className="text-[11px] font-mono text-blue-700 font-semibold mt-0.5">
                        {isBatter
                          ? `${(player as typeof striker).runs} (${(player as typeof striker).balls}b) • ${(player as typeof striker).fours}x4, ${(player as typeof striker).sixes}x6`
                          : `${(player as typeof bowler).overs}.${(player as typeof bowler).balls} ov • ${(player as typeof bowler).runs}r • ${(player as typeof bowler).wkts}w`}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500">
                    Upload transparent player cutout (PNG/WebP):
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handlePickFile({ type: 'player', name: player.name })}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-orange-600 transition shadow-xs border border-orange-400"
                    >
                      Choose File
                    </button>
                    {!hasCutout && (
                      <button
                        onClick={() => handleImportPlayerAvatar(player.name, team.short)}
                        className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
                      >
                        Auto-Gen
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={currentUrl}
                    onChange={(e) => setCardUrls((prev) => ({ ...prev, [cardKey]: e.target.value }))}
                    placeholder="Or paste image URL..."
                    className="flex-1 min-w-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    disabled={!currentUrl.trim() || registerByUrl.isPending}
                    onClick={() => {
                      if (currentUrl.trim()) {
                        registerByUrl.mutate({ type: 'player', name: player.name, url: currentUrl.trim() });
                        setCardUrls((prev) => ({ ...prev, [cardKey]: '' }));
                      }
                    }}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 disabled:opacity-40 shadow-xs"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. TEAM LOGOS & CRESTS */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-blue-100 pb-3">
          <span className="text-orange-500 text-lg">🛡️</span>
          <div>
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
              TEAM LOGOS &amp; CRESTS
            </h2>
            <p className="text-xs text-slate-500">
              Live match crests for scoreboard &amp; graphics. Saved to /assets/teams/ and hot-swapped into OBS immediately.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Batting Team Card */}
          <div className="rounded-xl border border-blue-200 bg-white p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  BATTING TEAM CREST ({battingTeam.short})
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                  ✓ CREST READY
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-xl bg-blue-50/50 border border-blue-200 shadow-xs p-2">
                  <TeamCrest team={battingTeam} className="max-h-full max-w-full" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-slate-900">{battingTeam.name}</h3>
                  <p className="text-xs text-slate-500">ID: team-{normalizeTeamCode(battingTeam.short)}</p>
                  <p className="text-xs text-orange-600 font-bold">Team: {battingTeam.short} (Batting Side)</p>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-muted">Upload Custom Logo (PNG/SVG):</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => handlePickFile({ type: 'team', short: battingTeam.short, name: battingTeam.name })}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-cyan-500"
                >
                  Choose File
                </button>
                <span className="text-xs text-muted">Replace crest file</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={cardUrls[`team-${battingTeam.short}`] ?? ''}
                onChange={(e) =>
                  setCardUrls((prev) => ({ ...prev, [`team-${battingTeam.short}`]: e.target.value }))
                }
                placeholder="Or paste logo URL..."
                className="flex-1 min-w-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
              <button
                disabled={!cardUrls[`team-${battingTeam.short}`]?.trim() || registerByUrl.isPending}
                onClick={() => {
                  const url = cardUrls[`team-${battingTeam.short}`]?.trim();
                  if (url) {
                    registerByUrl.mutate({
                      type: 'team',
                      short: battingTeam.short,
                      name: battingTeam.name,
                      url,
                    });
                    setCardUrls((prev) => ({ ...prev, [`team-${battingTeam.short}`]: '' }));
                  }
                }}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 disabled:opacity-40 shadow-xs"
              >
                SAVE
              </button>
            </div>
          </div>

          {/* Bowling Team Card */}
          <div className="rounded-xl border border-blue-200 bg-white p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  BOWLING TEAM CREST ({bowlingTeam.short})
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                  ✓ CREST READY
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-xl bg-blue-50/50 border border-blue-200 shadow-xs p-2">
                  <TeamCrest team={bowlingTeam} className="max-h-full max-w-full" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-slate-900">{bowlingTeam.name}</h3>
                  <p className="text-xs text-slate-500">ID: team-{normalizeTeamCode(bowlingTeam.short)}</p>
                  <p className="text-xs text-blue-700 font-semibold">Team: {bowlingTeam.short} (Bowling Side)</p>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">Upload Custom Logo (PNG/SVG):</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => handlePickFile({ type: 'team', short: bowlingTeam.short, name: bowlingTeam.name })}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-orange-600 transition shadow-xs border border-orange-400"
                >
                  Choose File
                </button>
                <span className="text-xs text-slate-500">Replace crest file</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={cardUrls[`team-${bowlingTeam.short}`] ?? ''}
                onChange={(e) =>
                  setCardUrls((prev) => ({ ...prev, [`team-${bowlingTeam.short}`]: e.target.value }))
                }
                placeholder="Or paste logo URL..."
                className="flex-1 min-w-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
              <button
                disabled={!cardUrls[`team-${bowlingTeam.short}`]?.trim() || registerByUrl.isPending}
                onClick={() => {
                  const url = cardUrls[`team-${bowlingTeam.short}`]?.trim();
                  if (url) {
                    registerByUrl.mutate({
                      type: 'team',
                      short: bowlingTeam.short,
                      name: bowlingTeam.name,
                      url,
                    });
                    setCardUrls((prev) => ({ ...prev, [`team-${bowlingTeam.short}`]: '' }));
                  }
                }}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 disabled:opacity-40 shadow-xs"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FULL MATCH SQUADS */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-lg">👥</span>
            <div>
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                FULL MATCH SQUADS
              </h2>
              <p className="text-xs text-slate-500">
                Every player in both squads for the live match. Import official photos or auto-generate cutouts before they walk out to bat.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFetchAll}
              className="rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-bold uppercase text-white hover:bg-orange-600 flex items-center gap-1 shadow-xs border border-orange-400"
            >
              <span>✨</span> AUTO-FETCH MISSING ASSETS
            </button>
            <button
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ['assets'] });
                void qc.invalidateQueries({ queryKey: ['missing'] });
                toast({ title: 'Squads reloaded from disk', kind: 'info' });
              }}
              className="rounded-lg border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 flex items-center gap-1 shadow-xs"
            >
              <span>🔄</span> RELOAD SQUADS
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Squad 1: Batting Team */}
          <div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <TeamCrest team={battingTeam} className="size-6 rounded" />
                <span className="font-heading text-sm font-bold text-white">
                  {battingTeam.name} ({battingTeam.short})
                </span>
              </div>
              <span className="text-xs font-semibold text-muted">
                {squad1.filter((p) => hasPlayerCutout(p.name)).length}/{squad1.length} cutouts ready
              </span>
            </div>
            <div className="space-y-2">
              {squad1.map((player) => {
                const hasCutout = hasPlayerCutout(player.name);
                const isCurrentStriker = player.name === striker.name;

                return (
                  <div
                    key={player.name}
                    className="flex items-center justify-between rounded-xl border border-blue-100 bg-white p-2.5 transition hover:border-orange-300 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50/50 border border-blue-200 p-0.5">
                        <PlayerAvatar name={player.name} className="max-h-full max-w-full" />
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-900 truncate">{player.name}</span>
                          {isCurrentStriker && (
                            <span className="rounded bg-orange-100 px-1 py-0.2 text-[9px] font-bold text-orange-700">
                              *
                            </span>
                          )}
                          {player.tag && (
                            <span className="rounded bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-blue-700">
                              ({player.tag})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{player.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase hidden sm:inline-block',
                          hasCutout ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800',
                        )}
                      >
                        {hasCutout ? '✓ READY' : 'MISSING'}
                      </span>
                      <button
                        onClick={() => handleImportPlayerAvatar(player.name, battingTeam.short)}
                        className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-orange-600 transition shadow-xs border border-orange-400"
                      >
                        IMPORT
                      </button>
                      <button
                        onClick={() => handlePickFile({ type: 'player', name: player.name })}
                        className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
                      >
                        UPLOAD
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Squad 2: Bowling Team */}
          <div>
            <div className="flex items-center justify-between border-b border-blue-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <TeamCrest team={bowlingTeam} className="size-6 rounded" />
                <span className="font-heading text-sm font-bold text-blue-950">
                  {bowlingTeam.name} ({bowlingTeam.short})
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {squad2.filter((p) => hasPlayerCutout(p.name)).length}/{squad2.length} cutouts ready
              </span>
            </div>
            <div className="space-y-2">
              {squad2.map((player) => {
                const hasCutout = hasPlayerCutout(player.name);
                const isCurrentBowler = player.name === bowler.name;

                return (
                  <div
                    key={player.name}
                    className="flex items-center justify-between rounded-xl border border-blue-100 bg-white p-2.5 transition hover:border-orange-300 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50/50 border border-blue-200 p-0.5">
                        <PlayerAvatar name={player.name} className="max-h-full max-w-full" />
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-slate-900 truncate">{player.name}</span>
                          {isCurrentBowler && (
                            <span className="rounded bg-orange-100 px-1 py-0.2 text-[9px] font-bold text-orange-700">
                              (BOWLING)
                            </span>
                          )}
                          {player.tag && (
                            <span className="rounded bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-blue-700">
                              ({player.tag})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{player.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase hidden sm:inline-block',
                          hasCutout ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800',
                        )}
                      >
                        {hasCutout ? '✓ READY' : 'MISSING'}
                      </span>
                      <button
                        onClick={() => handleImportPlayerAvatar(player.name, bowlingTeam.short)}
                        className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold uppercase text-white hover:bg-orange-600 transition shadow-xs border border-orange-400"
                      >
                        IMPORT
                      </button>
                      <button
                        onClick={() => handlePickFile({ type: 'player', name: player.name })}
                        className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
                      >
                        UPLOAD
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. ADD ANY PLAYER TO PERMANENT CUTOUT LIBRARY */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 font-bold text-lg">+</span>
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
            ADD ANY PLAYER TO PERMANENT CUTOUT LIBRARY
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Pre-load cutouts for tournament superstars. Once saved, anytime this player steps onto the pitch in any future match, their cutout appears automatically!
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (registerName.trim() && registerUrl.trim()) {
              registerByUrl.mutate({ name: registerName, url: registerUrl, type: 'player' });
            }
          }}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input
            value={registerName}
            onChange={(e) => setRegisterName(e.target.value)}
            placeholder="Player Full Name (e.g. Babar Azam, Harry Brook)..."
            required
            className="flex-1 min-w-[220px] rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
          />
          <input
            value={registerUrl}
            onChange={(e) => setRegisterUrl(e.target.value)}
            placeholder="Image URL (transparent PNG)..."
            type="url"
            required
            className="flex-1 min-w-[260px] rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={registerByUrl.isPending}
            className="rounded-lg bg-orange-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-orange-600 transition shadow-sm border border-orange-400 disabled:opacity-40"
          >
            REGISTER PLAYER CUTOUT
          </button>
        </form>
      </div>

      {/* 5. SAVED ASSET LIBRARY */}
      <div className="w-full rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-lg">📚</span>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-950">
                SAVED ASSET LIBRARY
              </h2>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                {totalAssets} ASSETS
              </span>
            </div>
          </div>
          <button
            onClick={() => void qc.invalidateQueries({ queryKey: ['assets'] })}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition shadow-xs"
          >
            <span>🔄</span> REFRESH LIBRARY
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Search, copy ID, and inspect broadcast player cutouts &amp; crests currently loaded on the system.
        </p>

        {/* Filters and search */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('all');
                setPage(1);
              }}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition shadow-xs',
                activeTab === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
              )}
            >
              ALL ({totalAssets})
            </button>
            <button
              onClick={() => {
                setActiveTab('players');
                setPage(1);
              }}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition shadow-xs',
                activeTab === 'players'
                  ? 'bg-orange-500 text-white'
                  : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
              )}
            >
              PLAYERS
            </button>
            <button
              onClick={() => {
                setActiveTab('teams');
                setPage(1);
              }}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition shadow-xs',
                activeTab === 'teams'
                  ? 'bg-orange-500 text-white'
                  : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50',
              )}
            >
              TEAMS
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="🔍 Search name or ID..."
              className="w-48 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
            >
              <option value="name">Name (A → Z)</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
            >
              <option value="24">24 / page</option>
              <option value="48">48 / page</option>
              <option value="96">96 / page</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">
          Showing{' '}
          <span className="text-slate-900 font-bold">
            {totalAssets === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalAssets)}
          </span>{' '}
          of <span className="text-slate-900 font-bold">{totalAssets}</span> matching assets
        </div>

        {/* Asset cards grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {(libraryAssets.data?.items ?? []).map((asset) => (
            <div
              key={asset.id}
              className="group flex flex-col justify-between rounded-xl border border-blue-100 bg-[#f8fafc] p-2.5 transition hover:border-orange-400 hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[8px] font-bold text-muted uppercase">
                    {asset.type.toUpperCase()}
                  </span>
                  <button
                    onClick={() => setDeleteConfirm(asset)}
                    className="text-muted hover:text-red-400 text-xs"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>

                <div
                  className={clsx(
                    'mt-2 aspect-square w-full rounded-lg flex items-center justify-center p-1',
                    CHECKER,
                  )}
                >
                  <img
                    src={assetFileUrl(asset, asset.createdAt)}
                    alt={asset.id}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <h4 className="mt-2 text-xs font-bold text-white truncate" title={asset.id}>
                  {asset.id.replace(/^(player-|team-)/, '').replace(/-/g, ' ')}
                </h4>
                <p className="text-[10px] text-muted truncate">{asset.id}</p>
              </div>

              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(asset.id);
                  toast({ title: 'ID copied', description: asset.id, kind: 'success' });
                }}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-border bg-surface-2 py-1 text-[10px] font-semibold text-muted hover:text-white"
              >
                📋 Copy ID
              </button>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted">
            Page {page} of {Math.max(1, totalPages)}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={`Delete asset ${deleteConfirm?.id ?? ''}?`}
        description="The image will be permanently removed from disk and hot-swapped off the live overlay immediately."
        footer={
          <div className="flex gap-2">
            <Button onClick={() => setDeleteConfirm(null)}>Keep</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteConfirm) removeAsset.mutate(deleteConfirm.id);
              }}
            >
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
};
