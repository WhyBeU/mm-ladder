"""Attendance & revenue report.

Counts unique players per ISO week (a week can hold several events — a player who
plays two events in the same week is counted once), rolls the weeks up per month,
and prices each attendance at a per-person rate that steps up on a cut-off date.

Usage (from backend/):
    poetry run python scripts/attendance_report.py                # local mm_ladder.db, 2025+2026
    poetry run python scripts/attendance_report.py --prod         # Neon prod ($NEON_DIRECT_URL)
    poetry run python scripts/attendance_report.py --prod --cup-years            # every MM Cup
    poetry run python scripts/attendance_report.py --prod --cup-years 2025 2026  # those cups

Totals break down per period: calendar years by default (--years), or per yearly cup with
--cup-years, which uses each cup's starts_on/ends_on instead of the calendar. Cups do not line
up with months, so a month straddling two cups is reported once per cup.

--weekly prints the week-by-week table and saves it to logs/attendance_{local,prod}_{ts}.csv
(override the destination with --csv-path).

--prod reads NEON_DIRECT_URL from the environment, falling back to backend/.env. Any URL may
be given in the app's async form (postgresql+asyncpg://...?ssl=require); it is translated to
the sync driver automatically. The report only runs SELECTs — it never writes or migrates.
"""

import argparse
import csv
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from _db_url import DEFAULT_DB_URL, PROD_URL_ENV, mask, resolve_db_url
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from mm_ladder.db_migrations import _sync_url
from mm_ladder.models import Player, Tournament, TournamentParticipant, YearlyCup

LOGS_DIR = Path(__file__).resolve().parents[1] / "logs"
DEFAULT_YEARS = (2025, 2026)
DEFAULT_CUTOFF = date(2025, 11, 1)
DEFAULT_RATE_BEFORE = 1.0
DEFAULT_RATE_AFTER = 2.0


@dataclass(frozen=True)
class Period:
    """A reporting bucket: a calendar year, or a cup's starts_on..ends_on window."""

    label: str
    start: date
    end: date

    def contains(self, day: date) -> bool:
        return self.start <= day <= self.end

    @property
    def range_label(self) -> str:
        return f"{self.start.isoformat()}..{self.end.isoformat()}"


@dataclass
class WeekRow:
    """One ISO week of play within one period: who showed up, across how many events."""

    period: Period
    week_start: date  # Monday of the ISO week
    iso_year: int
    iso_week: int
    player_ids: set[int] = field(default_factory=set)
    event_dates: set[date] = field(default_factory=set)

    @property
    def attendance(self) -> int:
        return len(self.player_ids)

    @property
    def events(self) -> int:
        return len(self.event_dates)


@dataclass
class MonthRow:
    """Weeks grouped by the month their Monday falls in, within one period."""

    period: Period
    year: int
    month: int
    weeks: list[WeekRow] = field(default_factory=list)

    @property
    def attendance(self) -> int:
        """Person-weeks: someone attending in 3 weeks of the month counts 3 times."""
        return sum(w.attendance for w in self.weeks)

    @property
    def events(self) -> int:
        return sum(w.events for w in self.weeks)

    @property
    def label(self) -> str:
        return f"{self.year}-{self.month:02d}"


def _to_date(value: object) -> date:
    """Date columns come back as `date`, but SQLite drivers can hand back a string."""
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def year_periods(years: tuple[int, ...]) -> list[Period]:
    return [Period(label=str(y), start=date(y, 1, 1), end=date(y, 12, 31)) for y in sorted(years)]


def cup_periods(session: Session, years: tuple[int, ...] | None) -> list[Period]:
    """One period per yearly cup, from its starts_on/ends_on. No years given = every cup."""
    stmt = select(YearlyCup.year, YearlyCup.name, YearlyCup.starts_on, YearlyCup.ends_on)
    if years:
        stmt = stmt.where(YearlyCup.year.in_(years))
    rows = sorted(session.execute(stmt).all(), key=lambda r: _to_date(r[2]))
    if not rows:
        print("no yearly cups found for the requested years", file=sys.stderr)
        raise SystemExit(2)

    periods: list[Period] = []
    for _year, name, starts_on, ends_on in rows:
        start = _to_date(starts_on)
        # Consecutive cups share their boundary day (2022 ends the day 2023 starts); give it to
        # the earlier cup so no event is ever counted — and billed — twice.
        if periods and start <= periods[-1].end:
            start = date.fromordinal(periods[-1].end.toordinal() + 1)
        periods.append(Period(label=str(name), start=start, end=_to_date(ends_on)))
    return periods


def load_weeks(session: Session, periods: list[Period], *, include_hidden: bool) -> list[WeekRow]:
    """Weeks are cut per period, so a week straddling a cup boundary splits into two rows."""
    stmt = (
        select(Tournament.held_on, TournamentParticipant.player_id)
        .join(TournamentParticipant, TournamentParticipant.tournament_id == Tournament.id)
        .join(Player, Player.id == TournamentParticipant.player_id)
    )
    if not include_hidden:
        stmt = stmt.where(Player.is_hidden.is_(False))

    weeks: dict[tuple[str, date], WeekRow] = {}
    skipped_events: set[date] = set()
    for held_on_raw, player_id in session.execute(stmt).all():
        held_on = _to_date(held_on_raw)
        period = next((p for p in periods if p.contains(held_on)), None)
        if period is None:
            skipped_events.add(held_on)
            continue
        iso_year, iso_week, iso_weekday = held_on.isocalendar()
        week_start = date.fromordinal(held_on.toordinal() - (iso_weekday - 1))
        row = weeks.get((period.label, week_start))
        if row is None:
            row = weeks[(period.label, week_start)] = WeekRow(
                period=period, week_start=week_start, iso_year=iso_year, iso_week=iso_week
            )
        row.player_ids.add(player_id)
        row.event_dates.add(held_on)

    ordered = sorted(weeks.values(), key=lambda w: (w.period.start, w.week_start))
    if skipped_events:
        in_span = [d for d in skipped_events if periods[0].start <= d <= periods[-1].end]
        if in_span:
            print(f"note: {len(in_span)} event(s) fell in gaps between periods and are not counted")
    return ordered


def group_by_month(weeks: list[WeekRow]) -> list[MonthRow]:
    months: dict[tuple[date, str, int, int], MonthRow] = {}
    for week in weeks:
        key = (week.period.start, week.period.label, week.week_start.year, week.week_start.month)
        if key not in months:
            months[key] = MonthRow(period=week.period, year=key[2], month=key[3])
        months[key].weeks.append(week)
    return [months[key] for key in sorted(months)]


def rate_for(week_start: date, cutoff: date, rate_before: float, rate_after: float) -> float:
    return rate_before if week_start < cutoff else rate_after


def revenue_for(month: MonthRow, cutoff: date, rate_before: float, rate_after: float) -> float:
    return sum(w.attendance * rate_for(w.week_start, cutoff, rate_before, rate_after) for w in month.weeks)


def print_weekly_table(
    weeks: list[WeekRow], cutoff: date, rate_before: float, rate_after: float, *, show_period: bool
) -> None:
    period_w = max((len(w.period.label) for w in weeks), default=6) if show_period else 0
    head = f"  {'Period':<{period_w}}  " if show_period else "  "
    print()
    print("=== Weekly attendance (unique players per ISO week) ===")
    print(f"{head}{'Week start':<12}  {'ISO':>8}  {'Events':>6}  {'Players':>7}  {'Rate':>5}  {'Value':>9}")
    print("  " + "-" * (58 + (period_w + 2 if show_period else 0)))
    for w in weeks:
        rate = rate_for(w.week_start, cutoff, rate_before, rate_after)
        iso = f"{w.iso_year}-W{w.iso_week:02d}"
        prefix = f"  {w.period.label:<{period_w}}  " if show_period else "  "
        print(
            f"{prefix}{w.week_start.isoformat():<12}  {iso:>8}  {w.events:>6}  {w.attendance:>7}"
            f"  ${rate:>4.0f}  ${w.attendance * rate:>8,.2f}"
        )


def write_weekly_csv(
    weeks: list[WeekRow],
    cutoff: date,
    rate_before: float,
    rate_after: float,
    *,
    source: str,
    path: Path | None = None,
) -> Path:
    """Dump the weekly rows to logs/, mirroring the --weekly table (one row per ISO week)."""
    if path is None:
        ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        path = LOGS_DIR / f"attendance_{source}_{ts}.csv"
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            ["period", "week_start", "iso_year", "iso_week", "month", "events", "attendance", "rate", "value"]
        )
        for w in weeks:
            rate = rate_for(w.week_start, cutoff, rate_before, rate_after)
            writer.writerow(
                [
                    w.period.label,
                    w.week_start.isoformat(),
                    w.iso_year,
                    w.iso_week,
                    f"{w.week_start.year}-{w.week_start.month:02d}",
                    w.events,
                    w.attendance,
                    f"{rate:.2f}",
                    f"{w.attendance * rate:.2f}",
                ]
            )
    return path


def print_monthly_table(
    months: list[MonthRow], cutoff: date, rate_before: float, rate_after: float, *, show_period: bool
) -> None:
    period_w = max((len(m.period.label) for m in months), default=6) if show_period else 0
    head = f"  {'Period':<{period_w}}  " if show_period else "  "
    print()
    print("=== Monthly summary ===")
    print(
        f"{head}{'Month':<8}  {'Weeks':>5}  {'Events':>6}  {'Attendances':>11}"
        f"  {'Avg/week':>8}  {'Rate':>5}  {'Value':>10}"
    )
    print("  " + "-" * (64 + (period_w + 2 if show_period else 0)))
    for m in months:
        rates = {rate_for(w.week_start, cutoff, rate_before, rate_after) for w in m.weeks}
        rate_label = f"${min(rates):.0f}" if len(rates) == 1 else "mixed"
        avg = m.attendance / len(m.weeks) if m.weeks else 0.0
        prefix = f"  {m.period.label:<{period_w}}  " if show_period else "  "
        print(
            f"{prefix}{m.label:<8}  {len(m.weeks):>5}  {m.events:>6}  {m.attendance:>11}"
            f"  {avg:>8.1f}  {rate_label:>5}"
            f"  ${revenue_for(m, cutoff, rate_before, rate_after):>9,.2f}"
        )


def print_period_totals(
    periods: list[Period], months: list[MonthRow], cutoff: date, rate_before: float, rate_after: float, *, title: str
) -> None:
    label_w = max(len("Period"), *(len(p.label) for p in periods))
    range_w = max(len("Range"), len(periods[0].range_label))
    print()
    print(f"=== {title} ===")
    print(
        f"  {'Period':<{label_w}}  {'Range':<{range_w}}  {'Weeks':>5}  {'Events':>6}"
        f"  {'Attendances':>11}  {'Value':>10}"
    )
    print("  " + "-" * (label_w + range_w + 42))
    grand_attendance = 0
    grand_value = 0.0
    for period in periods:
        rows = [m for m in months if m.period == period]
        attendance = sum(m.attendance for m in rows)
        value = sum(revenue_for(m, cutoff, rate_before, rate_after) for m in rows)
        weeks = sum(len(m.weeks) for m in rows)
        events = sum(m.events for m in rows)
        grand_attendance += attendance
        grand_value += value
        print(
            f"  {period.label:<{label_w}}  {period.range_label:<{range_w}}  {weeks:>5}  {events:>6}"
            f"  {attendance:>11}  ${value:>9,.2f}"
        )
    print("  " + "-" * (label_w + range_w + 42))
    print(f"  {'TOTAL':<{label_w}}  {'':<{range_w}}  {'':>5}  {'':>6}  {grand_attendance:>11}  ${grand_value:>9,.2f}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prod", action="store_true", help=f"Run against Neon prod (${PROD_URL_ENV})")
    parser.add_argument(
        "--db-url",
        default=None,
        help=f"Explicit SQLAlchemy URL, async form accepted (default: $DATABASE_URL, else {DEFAULT_DB_URL})",
    )
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument("--years", type=int, nargs="+", default=None, help="Calendar years to include")
    scope.add_argument(
        "--cup-years",
        type=int,
        nargs="*",
        default=None,
        help="Break down per yearly cup (cup starts_on..ends_on) instead of calendar years; no values = all cups",
    )
    parser.add_argument("--cutoff", default=DEFAULT_CUTOFF.isoformat(), help="Date the higher rate starts (YYYY-MM-DD)")
    parser.add_argument("--rate-before", type=float, default=DEFAULT_RATE_BEFORE, help="$ per person before cutoff")
    parser.add_argument("--rate-after", type=float, default=DEFAULT_RATE_AFTER, help="$ per person from cutoff on")
    parser.add_argument(
        "--weekly", action="store_true", help=f"Print the week-by-week table and save it as CSV under {LOGS_DIR.name}/"
    )
    parser.add_argument(
        "--csv-path", default=None, help="Write the weekly CSV here instead of logs/ (implies --weekly)"
    )
    parser.add_argument("--include-hidden", action="store_true", help="Count players flagged is_hidden")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cutoff = date.fromisoformat(args.cutoff)
    by_cup = args.cup_years is not None
    db_url = _sync_url(resolve_db_url(args.db_url, args.prod))  # accepts async URLs (aiosqlite / asyncpg)

    engine = create_engine(db_url)
    with Session(engine) as session:
        total_events = session.scalar(select(func.count()).select_from(Tournament)) or 0
        if by_cup:
            periods = cup_periods(session, tuple(args.cup_years) or None)
        else:
            periods = year_periods(tuple(args.years or DEFAULT_YEARS))
        weeks = load_weeks(session, periods, include_hidden=args.include_hidden)

    months = group_by_month(weeks)
    scope_label = "Cups" if by_cup else "Years"

    print(f"Source     : {mask(db_url)}")
    print(f"{scope_label:<11}: {', '.join(p.label for p in periods)}  ({total_events} events in DB overall)")
    print(
        f"Pricing    : ${args.rate_before:.0f}/person before {cutoff.isoformat()}, ${args.rate_after:.0f}/person from"
    )
    print("Week rule  : ISO weeks (Mon-Sun); a player counts once per week, months keyed by the week's Monday")

    if args.weekly or args.csv_path:
        print_weekly_table(weeks, cutoff, args.rate_before, args.rate_after, show_period=by_cup)
    print_monthly_table(months, cutoff, args.rate_before, args.rate_after, show_period=by_cup)
    print_period_totals(
        periods,
        months,
        cutoff,
        args.rate_before,
        args.rate_after,
        title="Cup totals" if by_cup else "Yearly totals",
    )

    if args.weekly or args.csv_path:
        csv_path = write_weekly_csv(
            weeks,
            cutoff,
            args.rate_before,
            args.rate_after,
            source="prod" if args.prod else "local",
            path=Path(args.csv_path) if args.csv_path else None,
        )
        print()
        print(f"Weekly CSV : {csv_path}")


if __name__ == "__main__":
    main()
