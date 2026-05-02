"use client";

import { useState, useMemo } from "react";
import { Search, X, Trophy, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Player {
  id: number | string;
  display_name: string | null;
  points: number;
  match_wins: number;
  match_losses: number;
  match_draws: number;
  tournaments_played: number;
  is_anonymous?: boolean;
}

type SortKey = "points" | "display_name" | "record" | "tournaments_played";
type SortDir = "asc" | "desc";

const initials = (name: string | null) => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

const winPct = (p: Player) => {
  const total = p.match_wins + p.match_losses + p.match_draws;
  return total === 0 ? 0 : (p.match_wins / total) * 100;
};

const rankRowStyles = (rank: number) => {
  if (rank === 1) return "border-accent-400/30 hover:border-accent-400/60 hover:shadow-gold-glow";
  if (rank === 2) return "border-silver-400/25 hover:border-silver-400/50 hover:shadow-silver-glow";
  if (rank === 3) return "border-bronze-400/25 hover:border-bronze-400/50 hover:shadow-bronze-glow";
  return "border-ink-700 hover:border-primary-500/50 hover:shadow-card-hover";
};

const rankEdgeBar = (rank: number) => {
  if (rank === 1) return "bg-gold-sheen";
  if (rank === 2) return "bg-silver-sheen";
  if (rank === 3) return "bg-bronze-sheen";
  return null;
};

const rankNumberColor = (rank: number) => {
  if (rank === 1) return "text-accent-400";
  if (rank === 2) return "text-silver-300";
  if (rank === 3) return "text-bronze-300";
  return "text-parchment-muted";
};

interface SortHeaderProps {
  label: string;
  columnKey: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
}

function SortHeader({ label, columnKey, sortKey, sortDir, onSort, align = "left" }: SortHeaderProps) {
  const active = sortKey === columnKey;
  const ChevronIcon = active
    ? (sortDir === "desc" ? ChevronDown : ChevronUp)
    : ChevronsUpDown;

  const justify =
    align === "right"  ? "justify-end"    :
    align === "center" ? "justify-center" :
    "justify-start";

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`flex items-center gap-1 ${justify} w-full text-[11px] uppercase tracking-widest
                  ${active ? "text-accent-400" : "text-parchment-faint hover:text-parchment-muted"}
                  transition-colors`}
    >
      <span>{label}</span>
      <ChevronIcon className="w-3 h-3" />
    </button>
  );
}

interface PlayerAvatarProps {
  player: Player;
  rank: number;
  showMedal: boolean;
}

function PlayerAvatar({ player, rank, showMedal }: PlayerAvatarProps) {
  if (player.is_anonymous) {
    return (
      <div className="w-9 h-9 rounded-full bg-ink-700 flex items-center justify-center text-parchment-muted">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8Zm0 4a3 3 0 1 1-3 3 3 3 0 0 1 3-3Zm0 14a7.94 7.94 0 0 1-6-2.74A6 6 0 0 1 12 16a6 6 0 0 1 6 3.26A7.94 7.94 0 0 1 12 22Z"/>
        </svg>
      </div>
    );
  }

  const baseClasses = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm";

  if (showMedal && rank === 1) return <div className={`${baseClasses} bg-gold-sheen text-ink-950 shadow-gold-glow`}>{initials(player.display_name)}</div>;
  if (showMedal && rank === 2) return <div className={`${baseClasses} bg-silver-sheen text-ink-950`}>{initials(player.display_name)}</div>;
  if (showMedal && rank === 3) return <div className={`${baseClasses} bg-bronze-sheen text-ink-950`}>{initials(player.display_name)}</div>;

  return (
    <div className={`${baseClasses} bg-primary-700 ring-1 ring-primary-500/40 text-parchment`}>
      {initials(player.display_name)}
    </div>
  );
}

interface LeaderboardProps {
  players?: Player[];
  season?: string;
}

export default function Leaderboard({ players = [], season = "" }: LeaderboardProps) {
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const showMedals = sortKey === "points" && sortDir === "desc";

  const handleSort = (key: string) => {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir(k === "display_name" ? "asc" : "desc");
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    let out = players.filter((p) => {
      if (!q) return true;
      if (p.is_anonymous) return false;
      return (p.display_name ?? "").toLowerCase().includes(q);
    });

    out = [...out].sort((a, b) => {
      if (sortKey === "display_name") {
        const av = (a.is_anonymous ? "~" : (a.display_name ?? "")).toLowerCase();
        const bv = (b.is_anonymous ? "~" : (b.display_name ?? "")).toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = sortKey === "record" ? a.match_wins : (a as Record<string, number>)[sortKey];
      const bv = sortKey === "record" ? b.match_wins : (b as Record<string, number>)[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return out;
  }, [players, search, sortKey, sortDir]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-5 py-8 md:py-12">

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-accent-400 shadow-gold-glow" />
          <span className="text-xs tracking-[0.25em] uppercase text-parchment-muted">Leaderboard</span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-parchment tracking-wide">MM Ladder</h1>
            <p className="text-parchment-muted mt-1 text-sm">Magic Mates Monday · Chromatic Games</p>
          </div>
          {season && (
            <span className="text-xs text-parchment-faint tracking-widest uppercase">{season}</span>
          )}
        </div>
      </header>

      {/* Search */}
      <div className="mb-5">
        <label className="relative block">
          <span className="sr-only">Search players</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-parchment-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players…"
            className="themed-surface w-full bg-ink-850 border border-ink-700
                       rounded-card pl-10 pr-10 py-2.5 text-sm text-parchment
                       placeholder:text-parchment-faint
                       focus:outline-none focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/20
                       transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment-faint hover:text-parchment-muted transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </label>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 items-center">
          <div className="col-span-1"><SortHeader label="Rank"        columnKey="points"             {...{ sortKey, sortDir, onSort: handleSort }} /></div>
          <div className="col-span-4"><SortHeader label="Player"      columnKey="display_name"       {...{ sortKey, sortDir, onSort: handleSort }} /></div>
          <div className="col-span-2"><SortHeader label="Pts"         columnKey="points"             {...{ sortKey, sortDir, onSort: handleSort }} align="right" /></div>
          <div className="col-span-2"><SortHeader label="W–L–D"       columnKey="record"             {...{ sortKey, sortDir, onSort: handleSort }} align="center" /></div>
          <div className="col-span-1"><span className="block text-[11px] uppercase tracking-widest text-parchment-faint text-center">Win %</span></div>
          <div className="col-span-2"><SortHeader label="Tournaments" columnKey="tournaments_played" {...{ sortKey, sortDir, onSort: handleSort }} align="right" /></div>
        </div>

        <ul className="space-y-2">
          {rows.map((player, i) => {
            const rank      = i + 1;
            const medalRank = showMedals && rank <= 3 ? rank : 0;
            const edgeBar   = medalRank ? rankEdgeBar(medalRank) : null;

            return (
              <li
                key={player.id}
                className={`themed-surface relative grid grid-cols-12 gap-3 items-center
                            bg-ink-850 hover:bg-ink-800 border rounded-card px-4 py-3
                            shadow-card transition-all duration-200
                            ${medalRank ? rankRowStyles(medalRank) : "border-ink-700 hover:border-primary-500/50 hover:shadow-card-hover"}`}
              >
                {edgeBar && <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${edgeBar}`} />}

                <div className="col-span-1 flex items-center gap-2">
                  {medalRank === 1 && <Trophy className="w-4 h-4 text-accent-400" />}
                  <span className={`font-display text-2xl font-bold ${medalRank ? rankNumberColor(medalRank) : "text-parchment-muted"}`}>{rank}</span>
                </div>

                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={player} rank={rank} showMedal={!!medalRank} />
                    <div className="min-w-0">
                      {player.is_anonymous ? (
                        <div className="font-semibold text-parchment-muted italic truncate">Anonymous Planeswalker</div>
                      ) : (
                        <div className="font-semibold text-parchment truncate">{player.display_name}</div>
                      )}
                      <div className="text-xs text-parchment-faint">{player.tournaments_played} events</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 text-right">
                  <span className={`font-display text-xl tabular-nums ${medalRank === 1 ? "text-accent-400" : "text-parchment"}`}>{player.points}</span>
                </div>

                <div className="col-span-2 text-center tabular-nums text-sm">
                  <span className="text-win font-semibold">{player.match_wins}</span>
                  <span className="text-parchment-faint">–</span>
                  <span className="text-loss font-semibold">{player.match_losses}</span>
                  <span className="text-parchment-faint">–</span>
                  <span className="text-draw font-semibold">{player.match_draws}</span>
                </div>

                <div className="col-span-1 text-center tabular-nums text-sm text-parchment-muted">
                  {winPct(player).toFixed(0)}%
                </div>

                <div className="col-span-2 text-right tabular-nums text-parchment">
                  {player.tournaments_played}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs uppercase tracking-widest text-parchment-faint" htmlFor="mobile-sort">Sort</label>
          <select
            id="mobile-sort"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              setSortKey(k as SortKey);
              setSortDir(d as SortDir);
            }}
            className="themed-surface bg-ink-850 border border-ink-700 rounded-md
                       text-sm text-parchment px-2 py-1.5
                       focus:outline-none focus:border-primary-500/60"
          >
            <option value="points:desc">Points (high → low)</option>
            <option value="points:asc">Points (low → high)</option>
            <option value="display_name:asc">Name (A → Z)</option>
            <option value="display_name:desc">Name (Z → A)</option>
            <option value="record:desc">Wins (high → low)</option>
            <option value="tournaments_played:desc">Tournaments (high → low)</option>
          </select>
        </div>

        <ul className="space-y-2">
          {rows.map((player, i) => {
            const rank      = i + 1;
            const medalRank = showMedals && rank <= 3 ? rank : 0;
            const edgeBar   = medalRank ? rankEdgeBar(medalRank) : null;

            return (
              <li
                key={player.id}
                className={`themed-surface relative bg-ink-850 hover:bg-ink-800
                            border rounded-card px-4 py-3 shadow-card transition-all duration-200
                            ${medalRank ? rankRowStyles(medalRank) : "border-ink-700"}`}
              >
                {edgeBar && <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${edgeBar}`} />}

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center w-8 shrink-0">
                    {medalRank === 1 && <Trophy className="w-4 h-4 text-accent-400" />}
                    <span className={`font-display text-xl font-bold ${medalRank ? rankNumberColor(medalRank) : "text-parchment-muted"}`}>{rank}</span>
                  </div>
                  <PlayerAvatar player={player} rank={rank} showMedal={!!medalRank} />
                  <div className="flex-1 min-w-0">
                    {player.is_anonymous ? (
                      <div className="font-semibold text-parchment-muted italic truncate">Anonymous Planeswalker</div>
                    ) : (
                      <div className="font-semibold text-parchment truncate">{player.display_name}</div>
                    )}
                    <div className="text-xs text-parchment-faint">
                      {player.tournaments_played} events · {winPct(player).toFixed(0)}% win
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-display text-xl tabular-nums ${medalRank === 1 ? "text-accent-400" : "text-parchment"}`}>{player.points}</div>
                    <div className="text-[10px] uppercase tracking-widest text-parchment-faint">pts</div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-ink-700/60 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-parchment-faint">Record</span>
                  <div className="tabular-nums text-sm">
                    <span className="text-win font-semibold">{player.match_wins}W</span>
                    <span className="text-parchment-faint mx-1">·</span>
                    <span className="text-loss font-semibold">{player.match_losses}L</span>
                    <span className="text-parchment-faint mx-1">·</span>
                    <span className="text-draw font-semibold">{player.match_draws}D</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="themed-surface bg-ink-850 border border-ink-700 rounded-card p-10 text-center">
          <div className="text-parchment-muted">
            No players match {search ? `"${search}"` : "the current filter"}.
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-3 text-sm text-primary-300 hover:text-accent-400 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Footer count */}
      <div className="mt-6 text-xs text-parchment-faint text-center">
        Showing {rows.length} of {players.length} players{search && " (filtered)"}
      </div>
    </main>
  );
}
