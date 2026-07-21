"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Scope, StandingEntry, SeasonStats, MMLEvent, YearlyCup, Season } from "@/lib/types";
import type { ApiParticipant, ApiPlayer, ApiTournament, ApiSeasonStanding, ApiSeason, ApiYearlyCup } from "@/lib/api";
import {
  fetchYearlyCups,
  fetchSeasons,
  fetchTournaments,
  fetchPlayers,
  fetchTournamentParticipants,
  fetchSeasonStandings,
} from "@/lib/api";
import { buildPlayerAwards, type PlayerAwards } from "@/lib/awards";
import Masthead from "@/components/Masthead";
import Leaderboard from "@/components/Leaderboard";
import { SeasonHero, StatsStrip } from "@/components/SeasonHero";
import { Podium } from "@/components/Podium";
import { QualifiedCards } from "@/components/QualifiedCards";
import AttendanceTimeline from "@/components/AttendanceTimeline";
import { buildAttendanceSeries } from "@/lib/attendance";
import ScopeBar from "@/components/ScopeBar";
import SiteFooter, { DiscordButton } from "@/components/SiteFooter";
import { WEEKLY_DRAFT_LINE } from "@/lib/site";

// ---------- Data adapters ----------

function toYearlyCup(c: ApiYearlyCup, today: string): YearlyCup {
  return { ...c, is_current: c.starts_on <= today && today <= c.ends_on };
}

function toSeason(s: ApiSeason, today: string): Season {
  return {
    ...s,
    keyrune: s.set_code.toLowerCase(),
    is_current: s.starts_on <= today && today <= s.ends_on,
  };
}

function tournamentsToEvents(tournaments: ApiTournament[]): MMLEvent[] {
  const sorted = [...tournaments].sort((a, b) => a.held_on.localeCompare(b.held_on) || a.id - b.id);
  const groups = new Map<string, ApiTournament[]>();
  for (const t of sorted) {
    const key = `${t.season_id}|${t.held_on}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  let num = 0;
  const result: MMLEvent[] = [];
  for (const [key, group] of groups) {
    const [seasonIdStr, heldOn] = key.split("|");
    num++;
    result.push({
      id: `e${num}`,
      season_id: parseInt(seasonIdStr),
      held_on: heldOn,
      number: num,
      pods: group.map(t => ({
        id: t.id,
        name: t.name ?? `MMM #${num}`,
        participant_count: 0,
        has_match_detail: t.has_match_detail,
      })),
    });
  }
  return result;
}

function buildStandings(
  participants: ApiParticipant[],
  players: ApiPlayer[],
  scopeTournamentIds: number[],
  scopeKind: string = "alltime",
  awards: Map<number, PlayerAwards> = new Map(),
): StandingEntry[] {
  const playerMap = new Map(
    players.filter(p => !p.is_hidden).map(p => [p.id, p]),
  );
  const byPlayer = new Map<number, ApiParticipant[]>();
  for (const p of participants) {
    if (!playerMap.has(p.player_id)) continue;
    if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, []);
    byPlayer.get(p.player_id)!.push(p);
  }
  const entries: StandingEntry[] = Array.from(byPlayer.entries()).map(([playerId, parts]) => {
    const player = playerMap.get(playerId)!;
    const wins = parts.reduce((s, p) => s + p.match_wins, 0);
    const losses = parts.reduce((s, p) => s + p.match_losses, 0);
    const draws = parts.reduce((s, p) => s + p.match_draws, 0);
    const total = wins + losses + draws;
    const points = parts.reduce((s, p) => s + p.points, 0);
    const byTId = new Map(parts.map(p => [p.tournament_id, p]));
    return {
      player_id: playerId,
      display_name: player.display_name,
      match_wins: wins,
      match_losses: losses,
      match_draws: draws,
      tournaments_played: parts.length,
      points,
      win_pct: total > 0 ? wins / total : 0,
      avg_pts: parts.length > 0 ? points / parts.length : 0,
      trophies: parts.filter(p => p.points === 9).length,
      rank: 0,
      delta: 0,
      streak: "",
      per_event_points: scopeTournamentIds.map(tid => byTId.get(tid)?.points ?? null),
      attended: scopeTournamentIds.map(tid => (byTId.has(tid) ? 1 : 0)) as (0 | 1)[],
      is_veteran: player.is_veteran,
      season_championships: awards.get(playerId)?.season_championships ?? [],
      player_of_the_year_years: awards.get(playerId)?.player_of_the_year_years ?? [],
      cup_champion_years: awards.get(playerId)?.cup_champion_years ?? [],
    };
  });
  const sorted = scopeKind === "cup"
    ? entries.sort((a, b) => b.trophies - a.trophies || b.points - a.points || b.win_pct - a.win_pct)
    : entries.sort((a, b) => b.points - a.points || b.win_pct - a.win_pct);
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

function apiSeasonStandingToEntry(s: ApiSeasonStanding): StandingEntry {
  return {
    player_id: s.player_id,
    display_name: s.display_name,
    match_wins: s.match_wins,
    match_losses: s.match_losses,
    match_draws: s.match_draws,
    tournaments_played: s.tournaments_played,
    points: s.points,
    win_pct: s.win_pct,
    avg_pts: s.avg_pts,
    trophies: s.trophies,
    rank: s.rank,
    delta: 0,
    streak: "",
    per_event_points: s.per_event_scores,
    attended: s.per_event_scores.map(v => (v != null ? 1 : 0)) as (0 | 1)[],
    comp_avg: s.comp_avg,
    comp_avg_n: s.comp_avg_n,
    is_veteran: s.is_veteran,
    season_championships: s.season_championships,
    player_of_the_year_years: s.player_of_the_year_years,
    cup_champion_years: s.cup_champion_years,
  };
}

// ---------- Helpers ----------
function computeStats(scopedEvents: MMLEvent[], scopeStandings: StandingEntry[]): SeasonStats {
  const podCount = scopedEvents.reduce((s, e) => s + e.pods.length, 0);
  const totalMatches = scopeStandings.reduce((s, p) => s + p.match_wins + p.match_losses + p.match_draws, 0) / 2;
  const totalAttendances = scopeStandings.reduce((s, p) => s + p.tournaments_played, 0);
  return {
    events: scopedEvents.length,
    pods: podCount,
    players: scopeStandings.length,
    matches: Math.round(totalMatches),
    matchesPerEvent: podCount ? totalMatches / podCount : 0,
    avgAttendance: podCount ? totalAttendances / podCount : 0,
  };
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  return `${Math.floor(min / 60)} hours ago`;
}

// ---------- Page ----------
export default function LeaderboardPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // null = user hasn't navigated yet; derive default from loaded seasons reactively
  const [scopeOverride, setScopeOverride] = useState<Scope | null>(null);
  const [lastUpdated] = useState(new Date());
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch navigation data
  const { data: apiYearlyCups = [] } = useQuery({ queryKey: ["yearly-cups"], queryFn: fetchYearlyCups });
  const { data: apiSeasons = [] } = useQuery({ queryKey: ["seasons"], queryFn: fetchSeasons });
  const { data: apiTournaments = [] } = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const { data: apiPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: fetchPlayers });

  // Adapt to frontend types
  const yearlyCups = useMemo(() => apiYearlyCups.map(c => toYearlyCup(c, today)), [apiYearlyCups, today]);
  const seasons = useMemo(() => apiSeasons.map(s => toSeason(s, today)), [apiSeasons, today]);
  const events = useMemo(() => tournamentsToEvents(apiTournaments), [apiTournaments]);

  // Derive default scope from loaded seasons (current season, or most recent)
  const defaultScope = useMemo((): Scope => {
    if (seasons.length === 0) return { kind: "season" };
    const current =
      seasons.find(s => s.starts_on <= today && today <= s.ends_on) ??
      [...seasons].sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
    return current
      ? { kind: "season", cupId: current.yearly_cup_id ?? undefined, seasonId: current.id }
      : { kind: "season" };
  }, [seasons, today]);

  const scope = scopeOverride ?? defaultScope;
  const setScope = (s: Scope) => setScopeOverride(s);

  // Determine which tournament IDs fall in the current scope
  const scopeTournamentIds = useMemo((): number[] => {
    switch (scope.kind) {
      case "alltime":
        return apiTournaments.map(t => t.id);
      case "cup": {
        if (scope.cupId == null) return [];
        const cupSeasonIds = apiSeasons.filter(s => s.yearly_cup_id === scope.cupId).map(s => s.id);
        return apiTournaments.filter(t => cupSeasonIds.includes(t.season_id)).map(t => t.id);
      }
      case "season":
        return scope.seasonId != null
          ? apiTournaments.filter(t => t.season_id === scope.seasonId).map(t => t.id)
          : [];
      case "event": {
        const event = events.find(e => e.id === scope.eventId);
        return event?.pods.map(p => p.id) ?? [];
      }
      case "pod":
        return scope.podId != null ? [scope.podId] : [];
      default:
        return [];
    }
  }, [scope, apiTournaments, apiSeasons, events]);

  // Season standings — server-computed (includes comp_avg, trophies)
  const { data: apiSeasonStandings } = useQuery({
    queryKey: ["season-standings", scope.seasonId],
    queryFn: () => fetchSeasonStandings(scope.seasonId!),
    enabled: scope.kind === "season" && scope.seasonId != null,
  });

  // Fetch participants for non-season scopes only
  const scopeKey = scopeTournamentIds.slice().sort((a, b) => a - b).join(",");
  const { data: rawParticipants = [] } = useQuery({
    queryKey: ["participants", scopeKey],
    queryFn: () =>
      Promise.all(scopeTournamentIds.map(fetchTournamentParticipants)).then(r => r.flat()),
    enabled: scopeTournamentIds.length > 0 && scope.kind !== "season",
  });

  // Real per-pod participant counts, from the scope's fetched participants (events are built
  // globally without counts since participants aren't fetched for every tournament up front).
  const participantCountByTid = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of rawParticipants) m.set(p.tournament_id, (m.get(p.tournament_id) ?? 0) + 1);
    return m;
  }, [rawParticipants]);

  // Champion awards, derived from already-fetched cups + seasons
  const playerAwards = useMemo(() => buildPlayerAwards(yearlyCups, seasons), [yearlyCups, seasons]);

  // Compute standings: API-backed for season scope, client-side otherwise
  const scopeStandings = useMemo(() => {
    if (scope.kind === "season" && apiSeasonStandings) {
      return apiSeasonStandings.map(apiSeasonStandingToEntry);
    }
    return buildStandings(rawParticipants, apiPlayers, scopeTournamentIds, scope.kind, playerAwards);
  }, [scope, apiSeasonStandings, rawParticipants, apiPlayers, scopeTournamentIds, playerAwards]);

  // Resolve context objects
  const cup    = scope.cupId    != null ? yearlyCups.find(y => y.id === scope.cupId)  ?? null : null;
  const season = scope.seasonId != null ? seasons.find(s => s.id === scope.seasonId)  ?? null : null;
  const event  = useMemo((): MMLEvent | null => {
    if (scope.eventId == null) return null;
    const e = events.find(ev => ev.id === scope.eventId);
    if (!e) return null;
    // Fill in each pod's real participant count for the hero.
    return { ...e, pods: e.pods.map(pod => ({ ...pod, participant_count: participantCountByTid.get(pod.id) ?? 0 })) };
  }, [scope.eventId, events, participantCountByTid]);

  // Scoped events for stats
  const scopedEvents = useMemo((): MMLEvent[] => {
    switch (scope.kind) {
      case "alltime":  return events;
      case "cup":      return events.filter(e => seasons.find(s => s.id === e.season_id)?.yearly_cup_id === scope.cupId);
      case "season":   return events.filter(e => e.season_id === scope.seasonId);
      case "event":    return event ? [event] : [];
      case "pod":      return event ? [event] : [];
      default:         return [];
    }
  }, [scope, events, seasons, event]);

  const stats = useMemo(() => computeStats(scopedEvents, scopeStandings), [scopedEvents, scopeStandings]);
  const leader = scopeStandings[0];
  const heroLeader = scope.kind === "cup" && cup?.player_of_the_year_id != null
    ? (scopeStandings.find(e => e.player_id === cup.player_of_the_year_id) ?? leader)
    : leader;

  // Cup qualifiers for the season's cup (season scope only) → gold checkmark on qualified players
  const seasonCup = scope.kind === "season" && season?.yearly_cup_id != null
    ? yearlyCups.find(c => c.id === season.yearly_cup_id) ?? null
    : null;
  const qualifiedPlayerIds = seasonCup ? new Set(seasonCup.qualified_player_ids) : undefined;

  const showPodium = (scope.kind === "season" || scope.kind === "cup" || scope.kind === "alltime") && scopeStandings.length >= 3;

  // All-time attendance-over-time timeline (desktop only; rendered under the podium).
  const attendanceSeries = useMemo(
    () => (scope.kind === "alltime" ? buildAttendanceSeries(events, rawParticipants, seasons, yearlyCups) : null),
    [scope.kind, events, rawParticipants, seasons, yearlyCups],
  );

  const heroCtx = {
    season: scope.kind === "alltime" ? null : (scope.kind === "cup" ? null : season),
    cup:    scope.kind === "alltime" ? null : cup,
  };

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden" }}>

      {/* Main column */}
      <div style={{ display: "flex", flexDirection: "column" }}>

        {/* Sticky header */}
        <Masthead
          current="leaderboard"
          title="Magic Mates Draft Ladder"
          subtitle={
            <>
              <DiscordButton />
              <span style={{ fontSize: 13, color: "var(--parchment-muted)" }}>
                <span style={{ fontWeight: 700, color: "var(--parchment)" }}>Weekly Drafts</span> — {WEEKLY_DRAFT_LINE}
              </span>
            </>
          }
        />

        {/* Scope bar — the single scope selector */}
        <ScopeBar scope={scope} setScope={setScope} yearlyCups={yearlyCups} seasons={seasons} events={events} />

        {/* Main content */}
        <main className="page-main">
          <SeasonHero
            scope={scope}
            season={heroCtx.season}
            cup={heroCtx.cup}
            event={event}
            leader={heroLeader}
            stats={stats}
            eventsCount={scopedEvents.length}
            compAvgN={scope.kind === "season" ? apiSeasonStandings?.[0]?.comp_avg_n : undefined}
            qualifyingType={scope.kind === "season" ? (season?.qualifying_type ?? "POINTS") : undefined}
            cupSeasons={scope.kind === "cup" ? seasons.filter(s => s.yearly_cup_id === scope.cupId) : undefined}
            onSeasonSelect={scope.kind === "cup" ? (s) => setScope({ kind: "season", cupId: s.yearly_cup_id ?? undefined, seasonId: s.id }) : undefined}
          />
          <StatsStrip stats={stats} totalPlayers={apiPlayers.filter(p => !p.is_hidden).length} />
          {scope.kind === "cup"
            ? <QualifiedCards standings={scopeStandings} qualifiedPlayerIds={cup?.qualified_player_ids ?? []} />
            : showPodium && <Podium standings={scopeStandings} />}
          {scope.kind === "alltime" && attendanceSeries && <AttendanceTimeline series={attendanceSeries} />}
          <Leaderboard
            standings={scopeStandings}
            scope={scope}
            season={season}
            scopedEvents={scopedEvents}
            defaultSortKey={scope.kind === "cup" ? "trophies" : scope.kind === "season" && season?.qualifying_type === "BEST" ? "comp_avg" : "points"}
            onEventSelect={(e) => setScope({ kind: "event", cupId: scope.cupId, seasonId: e.season_id, eventId: e.id })}
            qualifiedPlayerIds={qualifiedPlayerIds}
            qualifiedCupYear={seasonCup?.year ?? null}
          />
        </main>

        {/* Footer */}
        <SiteFooter>
          <span className="pulse-soft" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--win)", display: "inline-block" }} />
          <span>Last updated <span style={{ color: "var(--parchment-muted)" }}>{relativeTime(lastUpdated)}</span> · {stats.players} players in scope</span>
        </SiteFooter>
      </div>
    </div>
  );
}
