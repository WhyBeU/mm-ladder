"use client";

import { cloneElement, useState } from "react";
import { Calendar, Users, ChevronDown, X, Menu, Trophy } from "lucide-react";

const LOCALE = "en-AU";

const formatDateShort = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
};

const formatDateRange = (start: string | null | undefined, end: string | null | undefined) => {
  if (!start || !end) return "";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameYear = s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  const eStr = e.toLocaleDateString(LOCALE, sameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" }
  );
  return `${sStr} – ${eStr} ${e.getFullYear()}`;
};

function TournamentSkeleton() {
  return (
    <ul className="space-y-1.5 px-1 pt-2" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <li key={i} className="rounded-md bg-ink-850 px-3 py-2.5 animate-pulse">
          <div className="h-3 bg-ink-700 rounded w-2/3 mb-2" />
          <div className="h-2.5 bg-ink-700/60 rounded w-1/3" />
        </li>
      ))}
    </ul>
  );
}

export interface Season {
  id: number | string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Tournament {
  id: number | string;
  name: string;
  date: string;
  participant_count: number;
}

interface NavSidebarProps {
  seasons?: Season[];
  selectedSeasonId?: number | string;
  onSeasonChange: (id: string) => void;
  tournaments?: Tournament[];
  selectedTournamentId?: number | string | null;
  onTournamentChange: (id: number | string | null) => void;
  isLoading?: boolean;
  onClose?: () => void;
}

export function NavSidebar({
  seasons = [],
  selectedSeasonId,
  onSeasonChange,
  tournaments = [],
  selectedTournamentId,
  onTournamentChange,
  isLoading = false,
  onClose,
}: NavSidebarProps) {
  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  return (
    <aside className="h-full flex flex-col bg-ink-900 border-r border-ink-700">

      {/* Brand header */}
      <div className="px-5 pt-6 pb-4 border-b border-ink-700/60 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-sheen flex items-center justify-center
                          shadow-gold-glow shrink-0">
            <Trophy className="w-4 h-4 text-ink-950" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg text-parchment leading-tight">MM Ladder</div>
            <div className="text-[10px] uppercase tracking-widest text-parchment-faint">
              Magic Mates Monday
            </div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-md text-parchment-muted hover:text-parchment hover:bg-ink-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Season selector */}
      <div className="px-5 py-4 border-b border-ink-700/60">
        <label htmlFor="season-select" className="block text-[10px] uppercase tracking-widest text-parchment-faint mb-2">
          Season
        </label>
        <div className="relative">
          <select
            id="season-select"
            value={selectedSeasonId ?? ""}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="themed-surface w-full bg-ink-850 border border-ink-700
                       rounded-card pl-3 pr-9 py-2.5 text-sm text-parchment font-semibold
                       appearance-none cursor-pointer
                       focus:outline-none focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/20
                       transition-colors"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.is_current ? " · Current" : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-parchment-faint pointer-events-none" />
        </div>
        {selectedSeason && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-parchment-muted">
            <Calendar className="w-3 h-3" />
            <span className="tabular-nums">
              {formatDateRange(selectedSeason.start_date, selectedSeason.end_date)}
            </span>
          </div>
        )}
      </div>

      {/* Tournaments header + clear button */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-parchment-faint">
          Tournaments
        </span>
        {selectedTournamentId && (
          <button
            type="button"
            onClick={() => onTournamentChange(null)}
            className="text-[10px] uppercase tracking-widest text-primary-300 hover:text-accent-400 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Tournament list */}
      <nav className="flex-1 overflow-y-auto scroll-pretty px-3 pb-4">
        {isLoading ? (
          <TournamentSkeleton />
        ) : tournaments.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <div className="text-sm text-parchment-muted">No tournaments yet</div>
            <div className="text-xs text-parchment-faint mt-1">in this season</div>
          </div>
        ) : (
          <ul className="space-y-1">

            <li>
              <button
                type="button"
                onClick={() => onTournamentChange(null)}
                className={`themed-surface relative w-full text-left rounded-md px-3 py-2 text-sm
                            transition-all duration-150
                            ${!selectedTournamentId
                              ? "bg-primary-700/30 border border-primary-500/40 text-parchment"
                              : "border border-transparent text-parchment-muted hover:bg-ink-850 hover:text-parchment"}`}
                aria-pressed={!selectedTournamentId}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">All tournaments</span>
                  <span className="text-xs text-parchment-faint tabular-nums">{tournaments.length}</span>
                </div>
              </button>
            </li>

            <li className="px-3 py-2" aria-hidden="true">
              <div className="h-px bg-ink-700/60" />
            </li>

            {tournaments.map((t) => {
              const isActive = t.id === selectedTournamentId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onTournamentChange(t.id)}
                    className={`themed-surface relative w-full text-left rounded-md px-3 py-2.5
                                transition-all duration-150
                                ${isActive
                                  ? "bg-ink-850 border border-accent-400/50 shadow-card text-parchment"
                                  : "border border-transparent text-parchment-muted hover:bg-ink-850 hover:text-parchment"}`}
                    aria-pressed={isActive}
                    title={`${t.name} · ${formatDateShort(t.date)}`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gold-sheen" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate">{t.name}</div>
                      <div className="flex items-center gap-1 text-xs text-parchment-faint tabular-nums shrink-0">
                        <Users className="w-3 h-3" />
                        {t.participant_count}
                      </div>
                    </div>
                    <div className="text-xs text-parchment-faint mt-0.5 tabular-nums">
                      {formatDateShort(t.date)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-ink-700/60 text-[10px] uppercase tracking-widest text-parchment-faint">
        @ Chromatic Games · since 2016
      </div>
    </aside>
  );
}

interface NavLayoutProps {
  sidebar: React.ReactElement<NavSidebarProps>;
  children: React.ReactNode;
  mobileTitle?: string;
  mobileSubtitle?: string;
}

export function NavLayout({ sidebar, children, mobileTitle = "", mobileSubtitle = "" }: NavLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex">

      {/* Desktop sidebar */}
      <div className="hidden md:block w-72 lg:w-80 shrink-0 sticky top-0 h-screen">
        {sidebar}
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
            {cloneElement(sidebar, { onClose: () => setDrawerOpen(false) })}
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-30 bg-ink-950/80 backdrop-blur
                        border-b border-ink-700 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-md text-parchment-muted hover:text-parchment hover:bg-ink-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base text-parchment truncate">{mobileTitle}</div>
            {mobileSubtitle && (
              <div className="text-[10px] uppercase tracking-widest text-parchment-faint truncate">
                {mobileSubtitle}
              </div>
            )}
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

export default NavSidebar;
