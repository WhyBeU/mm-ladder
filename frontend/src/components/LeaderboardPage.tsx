"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, X, RefreshCw } from "lucide-react";

import Leaderboard from "@/components/Leaderboard";
import { NavSidebar } from "@/components/NavSidebar";
import ManaSwitcher from "@/components/ManaSwitcher";
import type { Season, Tournament } from "@/components/NavSidebar";
import type { Player } from "@/components/Leaderboard";

const LOCALE = "en-AU";

const formatDateShort = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
};

const formatRelative = (date: Date | null) => {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(LOCALE);
};

const formatAbsolute = (date: Date | null) =>
  date ? date.toLocaleString(LOCALE, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }) : "";

interface PageHeaderProps {
  season?: Season;
  tournament?: Tournament | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function PageHeader({ season, tournament, onRefresh, isRefreshing }: PageHeaderProps) {
  return (
    <header className="hidden md:block sticky top-0 z-20 bg-ink-950/85 backdrop-blur border-b border-ink-700">
      <div className="px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-parchment-faint">
            <span>Standings</span>
            <span className="text-parchment-faint/60">·</span>
            <span className="text-parchment-muted">
              {tournament ? `${tournament.name} · ${formatDateShort(tournament.date)}` : "Full season"}
            </span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl text-parchment tracking-wide mt-0.5 truncate">
            {season?.name ?? "MM Ladder"}
          </h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <ManaSwitcher />
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="hidden lg:flex items-center gap-1.5 text-xs text-parchment-muted hover:text-parchment transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}

interface MobileTopBarProps {
  onMenuClick: () => void;
  season?: Season;
  tournament?: Tournament | null;
}

function MobileTopBar({ onMenuClick, season, tournament }: MobileTopBarProps) {
  return (
    <div className="md:hidden sticky top-0 z-30 bg-ink-950/85 backdrop-blur border-b border-ink-700">
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-1.5 rounded-md text-parchment-muted hover:text-parchment hover:bg-ink-800 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="6" y2="6"/>
            <line x1="4" x2="20" y1="12" y2="12"/>
            <line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base text-parchment truncate leading-tight">
            {season?.name ?? "MM Ladder"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-parchment-faint truncate">
            {tournament ? tournament.name : "All tournaments"}
          </div>
        </div>
        <div className="shrink-0">
          <ManaSwitcher size="sm" />
        </div>
      </div>
    </div>
  );
}

interface FilterStripProps {
  tournament?: Tournament | null;
  onClear: () => void;
}

function FilterStrip({ tournament, onClear }: FilterStripProps) {
  if (!tournament) return null;
  return (
    <div className="themed-surface mb-5 flex items-center justify-between gap-3
                    bg-ink-850/60 border border-accent-400/30 rounded-card px-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <Trophy className="w-4 h-4 text-accent-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs text-parchment-faint uppercase tracking-widest">Filtered to</div>
          <div className="text-sm text-parchment font-semibold truncate">
            {tournament.name}
            <span className="text-parchment-muted font-normal">
              {" · "}{formatDateShort(tournament.date)}
              {" · "}{tournament.participant_count} players
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-primary-300 hover:text-accent-400 transition-colors uppercase tracking-widest flex items-center gap-1 shrink-0"
      >
        <X className="w-3 h-3" />
        <span className="hidden sm:inline">Clear filter</span>
        <span className="sm:hidden">Clear</span>
      </button>
    </div>
  );
}

interface PageFooterProps {
  lastUpdated: Date | null;
  playerCount?: number;
}

function PageFooter({ lastUpdated, playerCount }: PageFooterProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="mt-10 px-4 sm:px-6 lg:px-10 py-6 border-t border-ink-700/60">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-parchment-faint">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-win animate-pulse" />
          <span>
            Last updated{" "}
            <span className="text-parchment-muted" title={formatAbsolute(lastUpdated)}>
              {formatRelative(lastUpdated)}
            </span>
            {playerCount != null && <> · {playerCount} active players</>}
          </span>
        </div>
        <div className="uppercase tracking-widest">Magic Mates Monday @ Chromatic Games</div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------
// Data hook — STUB. Replace with TanStack Query in Step 5.
// ---------------------------------------------------------------
interface LeaderboardData {
  seasons: Season[];
  tournaments: Tournament[];
  players: Player[];
  isFetching: boolean;
  lastUpdated: Date;
  refetch: () => void;
}

function useLeaderboardData(_params: { seasonId: number | string; tournamentId: number | string | null }): LeaderboardData {
  return {
    seasons: [],
    tournaments: [],
    players: [],
    isFetching: false,
    lastUpdated: new Date(),
    refetch: () => {},
  };
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
interface LeaderboardPageProps {
  initialSeasonId?: string;
}

export default function LeaderboardPage({ initialSeasonId }: LeaderboardPageProps = {}) {
  const [seasonId, setSeasonId]       = useState<number | string>(initialSeasonId ?? "");
  const [tournamentId, setTournamentId] = useState<number | string | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  const { seasons, tournaments, players, isFetching, lastUpdated, refetch } =
    useLeaderboardData({ seasonId, tournamentId });

  const effectiveSeasonId = useMemo(() => {
    if (seasonId) return seasonId;
    const current = seasons.find((s) => s.is_current) ?? seasons[0];
    return current?.id ?? "";
  }, [seasonId, seasons]);

  const selectedSeason     = useMemo(() => seasons.find((s) => s.id === effectiveSeasonId), [seasons, effectiveSeasonId]);
  const selectedTournament = useMemo(() => tournaments.find((t) => t.id === tournamentId), [tournaments, tournamentId]);

  const handleSeasonChange = (id: string) => {
    setSeasonId(id);
    setTournamentId(null);
  };

  const handleTournamentChange = (id: number | string | null) => {
    setTournamentId(id);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* Desktop sidebar */}
      <div className="hidden md:block w-72 lg:w-80 shrink-0 sticky top-0 h-screen z-10">
        <NavSidebar
          seasons={seasons}
          selectedSeasonId={effectiveSeasonId}
          onSeasonChange={handleSeasonChange}
          tournaments={tournaments}
          selectedTournamentId={tournamentId}
          onTournamentChange={handleTournamentChange}
          isLoading={isFetching && !players.length}
        />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-ink-950/70 backdrop-blur-sm z-40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 shadow-2xl">
            <NavSidebar
              seasons={seasons}
              selectedSeasonId={effectiveSeasonId}
              onSeasonChange={handleSeasonChange}
              tournaments={tournaments}
              selectedTournamentId={tournamentId}
              onTournamentChange={handleTournamentChange}
              onClose={() => setDrawerOpen(false)}
              isLoading={isFetching && !players.length}
            />
          </div>
        </>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar
          onMenuClick={() => setDrawerOpen(true)}
          season={selectedSeason}
          tournament={selectedTournament}
        />
        <PageHeader
          season={selectedSeason}
          tournament={selectedTournament}
          onRefresh={refetch}
          isRefreshing={isFetching}
        />
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 md:py-8">
          <FilterStrip
            tournament={selectedTournament}
            onClear={() => setTournamentId(null)}
          />
          <Leaderboard players={players} season={selectedSeason?.name} />
        </main>
        <PageFooter lastUpdated={lastUpdated} playerCount={players.length} />
      </div>
    </div>
  );
}
