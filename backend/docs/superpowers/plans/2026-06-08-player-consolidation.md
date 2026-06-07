# Player Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `migrate consolidate-players` CLI command that finds likely-duplicate `Player`
records, lets the operator interactively review and merge them (recording alternate spellings as
`aliases`), and prevents the same duplicates from being recreated in future imports/admin actions.

**Architecture:** A new `aliases: list[str]` JSON column on `Player` (added via Alembic
migration). A small pure-function module `mm_ladder.services.player_matching` holds name
normalization and alias-aware matching, shared by the async `PlayerService.create` and the sync
migration `ensure_player`. A new `migration/consolidation.py` module holds fuzzy duplicate
detection, conflict checking, and merge planning/execution; `migration/cli.py` gets a thin
`consolidate-players` command that drives the interactive review loop using `click` prompts.

**Tech Stack:** Python 3.13, SQLAlchemy 2.0 (sync `Session` for migration tooling, async
`AsyncSession` for the API service), Alembic, click 8, pytest (sync `session` fixture from
`tests/conftest.py` for migration/model tests, async `client`/`async_session` fixtures for service
tests).

---

### Task 1: Add `aliases` column to `Player`

**Files:**
- Modify: `backend/src/mm_ladder/models/player.py`
- Create: `backend/alembic/versions/0007_add_aliases_to_player.py`
- Modify: `backend/tests/models/test_player.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/models/test_player.py` (inside `class TestPlayer`):

```python
    def test_aliases_defaults_to_empty_list(self, session):
        player = Player(display_name="Grace")
        session.add(player)
        session.commit()
        session.refresh(player)
        assert player.aliases == []

    def test_aliases_stores_list_of_strings(self, session):
        player = Player(display_name="Henry", aliases=["Hank", "H. Smith"])
        session.add(player)
        session.commit()
        session.refresh(player)
        assert player.aliases == ["Hank", "H. Smith"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `poetry run pytest tests/models/test_player.py -v -k aliases`
Expected: FAIL with `TypeError: 'aliases' is an invalid keyword argument for Player` (or
`AttributeError: 'Player' object has no attribute 'aliases'`)

- [ ] **Step 3: Add the column to the model**

In `backend/src/mm_ladder/models/player.py`, add `JSON` to the sqlalchemy import and add the
column:

```python
from sqlalchemy import JSON, Boolean, String
```

```python
    aliases: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
```

Place this line directly after `is_hidden`.

- [ ] **Step 4: Run test to verify it passes**

Run: `poetry run pytest tests/models/test_player.py -v -k aliases`
Expected: PASS (the test fixtures use `Base.metadata.create_all`, which picks up the new column
immediately — no migration needed for tests)

- [ ] **Step 5: Write the Alembic migration**

Create `backend/alembic/versions/0007_add_aliases_to_player.py`:

```python
"""add aliases to player

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-08
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("player") as batch_op:
        batch_op.add_column(
            sa.Column("aliases", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )


def downgrade() -> None:
    with op.batch_alter_table("player") as batch_op:
        batch_op.drop_column("aliases")
```

- [ ] **Step 6: Apply the migration to the dev database**

Run: `poetry run alembic upgrade head`
Expected: Output ends with `Running upgrade 0006 -> 0007, add aliases to player`

- [ ] **Step 7: Commit**

```bash
git add backend/src/mm_ladder/models/player.py backend/alembic/versions/0007_add_aliases_to_player.py backend/tests/models/test_player.py
git commit -m "feat(player): add aliases column for tracking alternate name spellings"
```

---

### Task 2: Name normalization helpers (`player_matching.py`)

**Files:**
- Create: `backend/src/mm_ladder/services/player_matching.py`
- Test: `backend/tests/services/test_player_matching.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/services/test_player_matching.py`:

```python
from mm_ladder.services.player_matching import name_tokens, normalize_player_name


def test_normalize_lowercases() -> None:
    assert normalize_player_name("Alice Smith") == normalize_player_name("alice smith")


def test_normalize_folds_accents() -> None:
    assert normalize_player_name("Damián Cengarle") == normalize_player_name("Damian Cengarle")


def test_normalize_strips_punctuation_and_whitespace_differences() -> None:
    assert normalize_player_name("Alex Norton - Smith") == normalize_player_name("Alex Norton-Smith")


def test_normalize_distinguishes_different_names() -> None:
    assert normalize_player_name("Alice Smith") != normalize_player_name("Alice Smyth")


def test_name_tokens_splits_on_whitespace_and_punctuation() -> None:
    assert name_tokens("Alex Norton - Smith") == ["alex", "norton", "smith"]
    assert name_tokens("Alex Norton-Smith") == ["alex", "norton", "smith"]


def test_name_tokens_folds_accents() -> None:
    assert name_tokens("Damián Cengarle") == ["damian", "cengarle"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/services/test_player_matching.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'mm_ladder.services.player_matching'`

- [ ] **Step 3: Implement the normalization helpers**

Create `backend/src/mm_ladder/services/player_matching.py`:

```python
import re
import unicodedata


def name_tokens(name: str) -> list[str]:
    """Split a name into lowercase, accent-folded, alphanumeric tokens.

    Folds accents to ASCII and splits on whitespace/punctuation, so
    "Damián Cengarle" -> ["damian", "cengarle"] and both "Alex Norton - Smith"
    and "Alex Norton-Smith" -> ["alex", "norton", "smith"].
    """
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return re.findall(r"[a-z0-9]+", folded.lower())


def normalize_player_name(name: str) -> str:
    """Collapse a name to a single comparison string, ignoring case, accents,
    whitespace, and punctuation differences."""
    return "".join(name_tokens(name))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/services/test_player_matching.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/mm_ladder/services/player_matching.py backend/tests/services/test_player_matching.py
git commit -m "feat(player): add name normalization helpers for alias matching"
```

---

### Task 3: Alias-aware matching helpers (`find_matching_player`, `register_alias_if_new`)

**Files:**
- Modify: `backend/src/mm_ladder/services/player_matching.py`
- Test: `backend/tests/services/test_player_matching.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/services/test_player_matching.py`:

```python
from mm_ladder.models.player import Player
from mm_ladder.services.player_matching import find_matching_player, register_alias_if_new


def test_find_matching_player_matches_on_normalized_display_name() -> None:
    alice = Player(display_name="Alice Smith")
    bob = Player(display_name="Bob Jones")
    assert find_matching_player([alice, bob], "alice  smith") is alice


def test_find_matching_player_matches_on_normalized_alias() -> None:
    damian = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    assert find_matching_player([damian], "Damian Cengarle") is damian


def test_find_matching_player_returns_none_when_no_match() -> None:
    alice = Player(display_name="Alice Smith")
    assert find_matching_player([alice], "Carol Lee") is None


def test_register_alias_if_new_appends_unseen_spelling() -> None:
    player = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    register_alias_if_new(player, "Damian C")
    assert player.aliases == ["Damián Cengarle", "Damian C"]


def test_register_alias_if_new_ignores_known_spelling() -> None:
    player = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    register_alias_if_new(player, "Damián Cengarle")
    assert player.aliases == ["Damián Cengarle"]


def test_register_alias_if_new_ignores_canonical_display_name() -> None:
    player = Player(display_name="Damian Cengarle Barilari", aliases=[])
    register_alias_if_new(player, "Damian Cengarle Barilari")
    assert player.aliases == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/services/test_player_matching.py -v -k "matching_player or register_alias"`
Expected: FAIL with `ImportError: cannot import name 'find_matching_player' ...`

- [ ] **Step 3: Implement the matching helpers**

Append to `backend/src/mm_ladder/services/player_matching.py` (add `from collections.abc import
Iterable` and `from mm_ladder.models.player import Player` to the imports at the top):

```python
from collections.abc import Iterable

from mm_ladder.models.player import Player
```

```python
def find_matching_player(players: Iterable[Player], display_name: str) -> Player | None:
    """Find a player whose display_name or any alias normalizes to the same name.

    Strict normalized-exact matching only — no fuzzy matching — so this is safe to
    use automatically at player-creation time without risking merging distinct people.
    """
    target = normalize_player_name(display_name)
    for player in players:
        if normalize_player_name(player.display_name) == target:
            return player
        if any(normalize_player_name(alias) == target for alias in player.aliases):
            return player
    return None


def register_alias_if_new(player: Player, display_name: str) -> None:
    """Record a new spelling of player's name as an alias, if it isn't already known."""
    known = {player.display_name, *player.aliases}
    if display_name not in known:
        player.aliases = [*player.aliases, display_name]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/services/test_player_matching.py -v`
Expected: PASS (all 12 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/mm_ladder/services/player_matching.py backend/tests/services/test_player_matching.py
git commit -m "feat(player): add alias-aware player matching for create-time dedup"
```

---

### Task 4: Wire alias matching into the migration importer's `ensure_player`

**Files:**
- Modify: `backend/migration/importer.py:69-78`
- Modify: `backend/tests/migration/test_importer.py`

Current `ensure_player` (lines 69-78):

```python
def ensure_player(session: Session, firstname: str, lastname: str) -> Player:
    """Find existing Player by normalized display_name or create it."""
    display_name = _normalize_name(firstname, lastname)
    player = session.query(Player).filter_by(display_name=display_name).first()
    if player is None:
        log.debug("creating player", display_name=display_name)
        player = Player(display_name=display_name)
        session.add(player)
        session.flush()
    return player
```

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/migration/test_importer.py`:

```python
def test_ensure_player_reuses_player_with_matching_alias(session: Session) -> None:
    from migration.importer import ensure_player
    from mm_ladder.models.player import Player

    canonical = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    session.add(canonical)
    session.flush()

    found = ensure_player(session, "Damian", "C")
    assert found.id == canonical.id
    assert found.aliases == ["Damián Cengarle", "Damian C"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `poetry run pytest tests/migration/test_importer.py -v -k reuses_player_with_matching_alias`
Expected: FAIL — a brand new "Damian C" player is created (`found.id != canonical.id`)

- [ ] **Step 3: Update `ensure_player`**

Replace the body of `ensure_player` in `backend/migration/importer.py:69-78`:

```python
def ensure_player(session: Session, firstname: str, lastname: str) -> Player:
    """Find existing Player by display_name/alias match or create it."""
    display_name = _normalize_name(firstname, lastname)
    player = session.query(Player).filter_by(display_name=display_name).first()
    if player is None:
        player = find_matching_player(session.query(Player).all(), display_name)
    if player is not None:
        register_alias_if_new(player, display_name)
        return player
    log.debug("creating player", display_name=display_name)
    player = Player(display_name=display_name)
    session.add(player)
    session.flush()
    return player
```

Add the import near the top of `backend/migration/importer.py` (alongside the other `mm_ladder`
imports):

```python
from mm_ladder.services.player_matching import find_matching_player, register_alias_if_new
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/migration/test_importer.py -v`
Expected: PASS (including the existing `test_normalize_name_deduplicates_*` tests, which still
pass via the fast exact-match path)

- [ ] **Step 5: Commit**

```bash
git add backend/migration/importer.py backend/tests/migration/test_importer.py
git commit -m "feat(migration): reuse aliased players in ensure_player to avoid re-creating duplicates"
```

---

### Task 5: Wire alias matching into `PlayerService.create`

**Files:**
- Modify: `backend/src/mm_ladder/services/player.py:50-55`
- Modify: `backend/tests/test_players.py`

Current `create` (lines 50-55):

```python
    async def create(self, data: PlayerCreateRequest) -> Player:
        player = Player(display_name=data.display_name, is_hidden=data.is_hidden)
        self._session.add(player)
        await self._session.commit()
        await self._session.refresh(player)
        return player
```

- [ ] **Step 1: Write the failing test**

`PlayerCreateRequest` has no `aliases` field and the create route doesn't expose one — aliases are
only ever set by the consolidation tooling, not via the public create API. So set up the existing
aliased player directly via the `async_session` fixture (it shares the same in-memory
`async_engine` as the `client` fixture, so both see the same data), then exercise the create
endpoint through `client`. Append to `backend/tests/test_players.py`:

```python
async def test_create_player_reuses_existing_alias(client: AsyncClient, async_session) -> None:
    from mm_ladder.models.player import Player

    canonical = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    async_session.add(canonical)
    await async_session.commit()
    await async_session.refresh(canonical)

    resp = await client.post("/players/", json={"display_name": "Damian C"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == canonical.id
    assert data["display_name"] == "Damian Cengarle Barilari"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `poetry run pytest tests/test_players.py -v -k reuses_existing_alias`
Expected: FAIL — response is a freshly created player (`data["id"] != canonical.id`,
`data["display_name"] == "Damian C"`)

- [ ] **Step 3: Update `PlayerService.create`**

Replace lines 50-55 in `backend/src/mm_ladder/services/player.py`:

```python
    async def create(self, data: PlayerCreateRequest) -> Player:
        result = await self._session.execute(select(Player))
        existing = find_matching_player(result.scalars().all(), data.display_name)
        if existing is not None:
            register_alias_if_new(existing, data.display_name)
            await self._session.commit()
            await self._session.refresh(existing)
            return existing

        player = Player(display_name=data.display_name, is_hidden=data.is_hidden)
        self._session.add(player)
        await self._session.commit()
        await self._session.refresh(player)
        return player
```

Add the import near the top of `backend/src/mm_ladder/services/player.py`:

```python
from mm_ladder.services.player_matching import find_matching_player, register_alias_if_new
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/test_players.py -v`
Expected: PASS (including the existing `test_create_and_get_player`, `test_list_players`, etc. —
none of those names collide with any existing player so the fast path is unaffected)

- [ ] **Step 5: Commit**

```bash
git add backend/src/mm_ladder/services/player.py backend/tests/test_players.py
git commit -m "feat(player): reuse aliased players on create to prevent future duplicates"
```

---

### Task 6: Fuzzy candidate grouping and survivor selection

**Files:**
- Create: `backend/migration/consolidation.py`
- Test: `backend/tests/migration/test_consolidation.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/migration/test_consolidation.py`:

```python
from datetime import datetime, timedelta

from mm_ladder.models.player import Player


def _player(display_name: str, *, created_offset: int = 0) -> Player:
    player = Player(display_name=display_name)
    player.created_at = datetime(2026, 1, 1) + timedelta(seconds=created_offset)
    return player


def test_find_candidate_groups_groups_punctuation_variants() -> None:
    from migration.consolidation import find_candidate_groups

    a = _player("Alex Norton - Smith")
    b = _player("Alex Norton-Smith", created_offset=1)
    groups = find_candidate_groups([a, b])

    assert len(groups) == 1
    assert {p.display_name for p in groups[0]} == {"Alex Norton - Smith", "Alex Norton-Smith"}


def test_find_candidate_groups_groups_accent_and_partial_name_variants() -> None:
    from migration.consolidation import find_candidate_groups

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    initial = _player("Damian C", created_offset=2)
    groups = find_candidate_groups([full, accented, initial])

    assert len(groups) == 1
    assert {p.display_name for p in groups[0]} == {
        "Damian Cengarle Barilari",
        "Damián Cengarle",
        "Damian C",
    }


def test_find_candidate_groups_does_not_group_unrelated_players() -> None:
    from migration.consolidation import find_candidate_groups

    alice = _player("Alice Smith")
    bob = _player("Bob Jones", created_offset=1)
    groups = find_candidate_groups([alice, bob])

    assert groups == []


def test_select_survivor_picks_longest_display_name() -> None:
    from migration.consolidation import select_survivor

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    initial = _player("Damian C", created_offset=2)

    assert select_survivor([accented, initial, full]) is full


def test_select_survivor_breaks_ties_with_earliest_created_at() -> None:
    from migration.consolidation import select_survivor

    earlier = _player("Alex Norton-Smith", created_offset=0)
    later = _player("Alex Norton Smith", created_offset=10)

    assert select_survivor([later, earlier]) is earlier
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/migration/test_consolidation.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'migration.consolidation'`

- [ ] **Step 3: Implement grouping and survivor selection**

Create `backend/migration/consolidation.py`:

```python
from collections import defaultdict
from itertools import combinations

from mm_ladder.logger import get_logger
from mm_ladder.models.player import Player
from mm_ladder.services.player_matching import name_tokens

log = get_logger("migration.consolidation")


def _are_likely_variants(tokens_a: list[str], tokens_b: list[str]) -> bool:
    """True if two surname-token lists look like spellings of the same name.

    Covers exact matches (punctuation-only differences already collapsed by
    name_tokens), shared tokens (e.g. a shared hyphenated surname), and one
    name being a prefix/subset of the other (e.g. "C" vs "Cengarle Barilari",
    or a missing middle name).
    """
    set_a, set_b = set(tokens_a), set(tokens_b)
    if not set_a or not set_b:
        return True
    if set_a == set_b or set_a & set_b:
        return True
    return set_a <= set_b or set_b <= set_a


def _connected_groups(pairs: list[tuple[Player, Player]]) -> list[list[Player]]:
    """Merge pairwise candidate matches into connected groups via union-find,
    so that A~B and B~C produce a single {A, B, C} group."""
    parent: dict[int, int] = {}

    def find(player_id: int) -> int:
        parent.setdefault(player_id, player_id)
        while parent[player_id] != player_id:
            parent[player_id] = parent[parent[player_id]]
            player_id = parent[player_id]
        return player_id

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_a] = root_b

    by_id: dict[int, Player] = {}
    for player_a, player_b in pairs:
        by_id[player_a.id] = player_a
        by_id[player_b.id] = player_b
        union(player_a.id, player_b.id)

    grouped: dict[int, list[Player]] = defaultdict(list)
    for player_id, player in by_id.items():
        grouped[find(player_id)].append(player)

    return [sorted(group, key=lambda p: p.id) for group in grouped.values()]


def find_candidate_groups(players: list[Player]) -> list[list[Player]]:
    """Find groups of players whose names look like alternate spellings of the
    same person.

    Players are bucketed by their first name token (accent/punctuation-folded),
    then paired within each bucket when their remaining (surname) tokens are
    identical, overlap, or one is a prefix/subset of the other. Pairs are then
    merged into connected groups so a 3-way match (e.g. a full name, an accented
    short form, and an initial) forms one group rather than separate pairs.

    This is intentionally permissive — it surfaces likely-unrelated pairs (e.g.
    two different people who share a surname) too, for a human to reject.
    """
    by_first_name: dict[str, list[Player]] = defaultdict(list)
    for player in players:
        tokens = name_tokens(player.display_name)
        if tokens:
            by_first_name[tokens[0]].append(player)

    pairs: list[tuple[Player, Player]] = []
    for members in by_first_name.values():
        if len(members) < 2:
            continue
        for player_a, player_b in combinations(members, 2):
            rest_a = name_tokens(player_a.display_name)[1:]
            rest_b = name_tokens(player_b.display_name)[1:]
            if _are_likely_variants(rest_a, rest_b):
                pairs.append((player_a, player_b))

    return _connected_groups(pairs)


def select_survivor(group: list[Player]) -> Player:
    """Pick the canonical player for a group: the longest display_name (assumed
    most complete/unique), tie-broken by earliest created_at."""
    return min(group, key=lambda p: (-len(p.display_name), p.created_at))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/migration/test_consolidation.py -v`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/migration/consolidation.py backend/tests/migration/test_consolidation.py
git commit -m "feat(migration): add fuzzy duplicate-player grouping and survivor selection"
```

---

### Task 7: Conflict detection

**Files:**
- Modify: `backend/migration/consolidation.py`
- Modify: `backend/tests/migration/test_consolidation.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/migration/test_consolidation.py` (add the new imports at the top of the
file: `from mm_ladder.models.match import Match`, `from mm_ladder.models.season import Season`,
`from mm_ladder.models.tournament import Tournament`,
`from mm_ladder.models.tournament_participant import TournamentParticipant`, and
`from sqlalchemy.orm import Session`):

```python
def _season(set_code: str) -> Season:
    return Season(
        name="Test Season",
        set_code=set_code,
        starts_on=datetime(2026, 1, 1).date(),
        ends_on=datetime(2026, 3, 1).date(),
        qualifier_count=0,
        qualifying_type="POINTS",
    )


def test_find_conflicts_detects_shared_tournament_participation(session: Session) -> None:
    from migration.consolidation import find_conflicts

    season = _season("tst")
    session.add(season)
    session.flush()
    tournament = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    session.add(tournament)
    session.flush()

    alice = _player("Alice Smith")
    alicia = _player("Alicia Smith", created_offset=1)
    session.add_all([alice, alicia])
    session.flush()
    session.add_all(
        [
            TournamentParticipant(tournament_id=tournament.id, player_id=alice.id),
            TournamentParticipant(tournament_id=tournament.id, player_id=alicia.id),
        ]
    )
    session.flush()

    conflicts = find_conflicts(session, [alice, alicia])
    assert len(conflicts) == 1
    assert "Week 1" in conflicts[0].description


def test_find_conflicts_detects_head_to_head_match(session: Session) -> None:
    from migration.consolidation import find_conflicts

    season = _season("tst")
    session.add(season)
    session.flush()
    tournament = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    session.add(tournament)
    session.flush()

    alice = _player("Alice Smith")
    alicia = _player("Alicia Smith", created_offset=1)
    session.add_all([alice, alicia])
    session.flush()
    session.add(Match(tournament_id=tournament.id, player_a_id=alice.id, player_b_id=alicia.id))
    session.flush()

    conflicts = find_conflicts(session, [alice, alicia])
    assert len(conflicts) == 1
    assert "Week 1" in conflicts[0].description


def test_find_conflicts_returns_empty_for_clean_group(session: Session) -> None:
    from migration.consolidation import find_conflicts

    alice = _player("Alice Smith")
    alicia = _player("Alicia Smith", created_offset=1)
    session.add_all([alice, alicia])
    session.flush()

    assert find_conflicts(session, [alice, alicia]) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/migration/test_consolidation.py -v -k find_conflicts`
Expected: FAIL with `ImportError: cannot import name 'find_conflicts' ...`

- [ ] **Step 3: Implement conflict detection**

Add to the top of `backend/migration/consolidation.py` (extend the existing import block):

```python
from collections import defaultdict
from dataclasses import dataclass
from itertools import combinations

from sqlalchemy.orm import Session

from mm_ladder.logger import get_logger
from mm_ladder.models.match import Match
from mm_ladder.models.player import Player
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.services.player_matching import name_tokens
```

Append to `backend/migration/consolidation.py`:

```python
@dataclass
class Conflict:
    """A pair within a candidate group that cannot be merged without violating
    a database constraint."""

    player_a: Player
    player_b: Player
    description: str


def find_conflicts(session: Session, group: list[Player]) -> list[Conflict]:
    """Find pairs in a candidate group that cannot be merged because doing so
    would violate a database constraint:

    - both played in the same tournament (would violate uq_tp_tournament_player)
    - they faced each other in a match (would violate ck_match_different_players)
    """
    conflicts: list[Conflict] = []
    player_ids = [player.id for player in group]
    by_id = {player.id: player for player in group}

    participations = (
        session.query(TournamentParticipant.player_id, Tournament.name)
        .join(Tournament, Tournament.id == TournamentParticipant.tournament_id)
        .filter(TournamentParticipant.player_id.in_(player_ids))
        .all()
    )
    by_tournament: dict[str, list[int]] = defaultdict(list)
    for player_id, tournament_name in participations:
        by_tournament[tournament_name].append(player_id)
    for tournament_name, ids in by_tournament.items():
        for id_a, id_b in combinations(sorted(set(ids)), 2):
            conflicts.append(
                Conflict(by_id[id_a], by_id[id_b], f'both played in "{tournament_name}"')
            )

    matches = (
        session.query(Match.player_a_id, Match.player_b_id, Tournament.name)
        .join(Tournament, Tournament.id == Match.tournament_id)
        .filter(Match.player_a_id.in_(player_ids), Match.player_b_id.in_(player_ids))
        .all()
    )
    for player_a_id, player_b_id, tournament_name in matches:
        conflicts.append(
            Conflict(by_id[player_a_id], by_id[player_b_id], f'faced each other in "{tournament_name}"')
        )

    return conflicts
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/migration/test_consolidation.py -v`
Expected: PASS (all tests, including Task 6's)

- [ ] **Step 5: Commit**

```bash
git add backend/migration/consolidation.py backend/tests/migration/test_consolidation.py
git commit -m "feat(migration): detect merge conflicts (shared tournaments/head-to-head matches)"
```

---

### Task 8: Merge planning and execution

**Files:**
- Modify: `backend/migration/consolidation.py`
- Modify: `backend/tests/migration/test_consolidation.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/migration/test_consolidation.py` (add `from sqlalchemy import or_` is not
needed in the test; add `from mm_ladder.models.player import Player` is already present):

```python
def test_plan_merge_computes_aliases_and_counts(session: Session) -> None:
    from migration.consolidation import plan_merge

    season = _season("tst")
    session.add(season)
    session.flush()
    tournament = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    session.add(tournament)
    session.flush()

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    initial = _player("Damian C", created_offset=2)
    bystander = _player("Carol Lee", created_offset=3)
    session.add_all([full, accented, initial, bystander])
    session.flush()
    session.add_all(
        [
            TournamentParticipant(tournament_id=tournament.id, player_id=accented.id),
            Match(tournament_id=tournament.id, player_a_id=initial.id, player_b_id=bystander.id),
        ]
    )
    session.flush()

    plan = plan_merge(session, [full, accented, initial])

    assert plan.survivor is full
    assert {p.id for p in plan.merged} == {accented.id, initial.id}
    assert plan.new_aliases == ["Damián Cengarle", "Damian C"]
    assert plan.participant_count == 1
    assert plan.match_count == 1


def test_plan_merge_skips_already_known_aliases(session: Session) -> None:
    from migration.consolidation import plan_merge

    full = Player(display_name="Damian Cengarle Barilari", aliases=["Damian C"])
    full.created_at = datetime(2026, 1, 1)
    accented = _player("Damián Cengarle", created_offset=1)
    session.add_all([full, accented])
    session.flush()

    plan = plan_merge(session, [full, accented])
    assert plan.new_aliases == ["Damián Cengarle"]


def test_execute_merge_repoints_references_and_deletes_merged_players(session: Session) -> None:
    from migration.consolidation import execute_merge, plan_merge

    season = _season("tst")
    session.add(season)
    session.flush()
    week1 = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    week2 = Tournament(season_id=season.id, held_on=datetime(2026, 1, 12).date(), name="Week 2")
    session.add_all([week1, week2])
    session.flush()

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    bystander = _player("Carol Lee", created_offset=2)
    session.add_all([full, accented, bystander])
    session.flush()
    session.add_all(
        [
            TournamentParticipant(tournament_id=week1.id, player_id=accented.id),
            Match(tournament_id=week2.id, player_a_id=accented.id, player_b_id=bystander.id),
        ]
    )
    session.flush()
    accented_id = accented.id

    plan = plan_merge(session, [full, accented])
    execute_merge(session, plan)
    session.commit()

    assert session.get(Player, accented_id) is None
    assert full.aliases == ["Damián Cengarle"]

    participant = session.query(TournamentParticipant).filter_by(tournament_id=week1.id).one()
    assert participant.player_id == full.id

    match = session.query(Match).filter_by(tournament_id=week2.id).one()
    assert match.player_a_id == full.id
    assert match.player_b_id == bystander.id
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/migration/test_consolidation.py -v -k "plan_merge or execute_merge"`
Expected: FAIL with `ImportError: cannot import name 'plan_merge' ...`

- [ ] **Step 3: Implement merge planning and execution**

Add `or_` to the sqlalchemy import in `backend/migration/consolidation.py`:

```python
from sqlalchemy import or_
from sqlalchemy.orm import Session
```

Append to `backend/migration/consolidation.py`:

```python
@dataclass
class MergePlan:
    """The computed result of merging a candidate group: who survives, who is
    merged away, what aliases the survivor gains, and how many rows need
    repointing."""

    survivor: Player
    merged: list[Player]
    new_aliases: list[str]
    participant_count: int
    match_count: int


def plan_merge(session: Session, group: list[Player]) -> MergePlan:
    """Compute the merge plan for a (conflict-free) candidate group without
    making any changes."""
    survivor = select_survivor(group)
    merged = [player for player in group if player.id != survivor.id]
    merged_ids = [player.id for player in merged]

    known = {survivor.display_name, *survivor.aliases}
    new_aliases = [player.display_name for player in merged if player.display_name not in known]

    participant_count = (
        session.query(TournamentParticipant)
        .filter(TournamentParticipant.player_id.in_(merged_ids))
        .count()
    )
    match_count = (
        session.query(Match)
        .filter(or_(Match.player_a_id.in_(merged_ids), Match.player_b_id.in_(merged_ids)))
        .count()
    )
    return MergePlan(survivor, merged, new_aliases, participant_count, match_count)


def execute_merge(session: Session, plan: MergePlan) -> None:
    """Apply a merge plan: record aliases, repoint tournament_participant and
    match references to the survivor, and delete the merged-away player rows."""
    survivor = plan.survivor
    merged_ids = [player.id for player in plan.merged]

    survivor.aliases = [*survivor.aliases, *plan.new_aliases]

    session.query(TournamentParticipant).filter(TournamentParticipant.player_id.in_(merged_ids)).update(
        {TournamentParticipant.player_id: survivor.id}, synchronize_session="fetch"
    )
    session.query(Match).filter(Match.player_a_id.in_(merged_ids)).update(
        {Match.player_a_id: survivor.id}, synchronize_session="fetch"
    )
    session.query(Match).filter(Match.player_b_id.in_(merged_ids)).update(
        {Match.player_b_id: survivor.id}, synchronize_session="fetch"
    )

    for player in plan.merged:
        session.expire(player)
        session.delete(player)
    session.flush()
    log.info(
        "merged players",
        survivor=survivor.display_name,
        merged=[player.display_name for player in plan.merged],
    )
```

The `session.expire(player)` calls clear any cached `participations`/`matches_as_*` collections on
the merged players before deletion — without this, SQLAlchemy may try to null out the (non-nullable)
foreign keys on stale cached rows when the parent is deleted, raising an `IntegrityError`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/migration/test_consolidation.py -v`
Expected: PASS (all tests, including Tasks 6 and 7)

- [ ] **Step 5: Commit**

```bash
git add backend/migration/consolidation.py backend/tests/migration/test_consolidation.py
git commit -m "feat(migration): add merge planning and execution for player consolidation"
```

---

### Task 9: `consolidate-players` CLI command

**Files:**
- Modify: `backend/migration/consolidation.py`
- Modify: `backend/migration/cli.py`

This task wires the pure functions from Tasks 6-8 into an interactive CLI flow. Per your direction
("don't run anything through claude, let's only do action through the command"), this is a
human-operated tool — there are no automated tests for the click prompt loop itself (the codebase
has no `CliRunner` tests for any existing migration command either); verification is via running
the command by hand in Step 5.

- [ ] **Step 1: Add the orchestration functions to `consolidation.py`**

Append to `backend/migration/consolidation.py` (add `import click` at the top of the file, with
the other third-party imports):

```python
import click
```

```python
def _describe_player(player: Player, *, is_survivor: bool) -> str:
    marker = "  <- proposed survivor" if is_survivor else ""
    events = len(player.participations)
    return f"{player.display_name} ({events} events, created {player.created_at:%Y-%m-%d}){marker}"


def _print_plan(plan: MergePlan) -> None:
    click.echo(f'  Plan: keep "{plan.survivor.display_name}" (id={plan.survivor.id})')
    click.echo(f"    new aliases: {plan.new_aliases}")
    click.echo(f"    repoint {plan.participant_count} tournament participation row(s)")
    click.echo(f"    repoint {plan.match_count} match row(s)")
    click.echo(f"    delete player row(s): {[player.display_name for player in plan.merged]}")


def review_group(session: Session, label: str, group: list[Player], *, dry_run: bool) -> None:
    """Print a candidate group, let the operator exclude members or skip it,
    then preview and (optionally) apply the resulting merge plan."""
    click.echo(f"\n{label}:")
    survivor = select_survivor(group)
    for index, player in enumerate(group, start=1):
        click.echo(f"  [{index}] {_describe_player(player, is_survivor=player.id == survivor.id)}")

    conflicts = find_conflicts(session, group)
    if conflicts:
        click.echo("  Skipped — merging would violate database constraints:")
        for conflict in conflicts:
            click.echo(
                f"    {conflict.player_a.display_name} & {conflict.player_b.display_name}: {conflict.description}"
            )
        return

    raw = click.prompt(
        "  Exclude any from this merge? (comma-separated numbers, blank = merge all, 's' = skip group)",
        default="",
        show_default=False,
    )
    choice = raw.strip().lower()
    if choice == "s":
        click.echo("  Skipped.")
        return

    excluded: set[int] = set()
    if choice:
        try:
            excluded = {int(part.strip()) for part in choice.split(",") if part.strip()}
        except ValueError:
            click.echo("  Invalid input — skipping group.")
            return

    remaining = [player for index, player in enumerate(group, start=1) if index not in excluded]
    if len(remaining) < 2:
        click.echo("  Fewer than 2 players remain — skipping group.")
        return

    plan = plan_merge(session, remaining)
    _print_plan(plan)

    if dry_run:
        click.echo("  (dry run — no changes made)")
        return

    if not click.confirm("  Apply this merge?", default=False):
        click.echo("  Skipped.")
        return

    execute_merge(session, plan)
    session.commit()
    click.echo("  Merged.")


def run_auto_consolidation(session: Session, *, dry_run: bool) -> None:
    """Detect candidate duplicate groups and walk the operator through each one."""
    players = session.query(Player).all()
    groups = find_candidate_groups(players)
    if not groups:
        click.echo("No candidate duplicate groups found.")
        return

    click.echo(f"Found {len(groups)} candidate group(s).")
    for index, group in enumerate(groups, start=1):
        review_group(session, f"Group {index}", group, dry_run=dry_run)


def run_select_consolidation(session: Session, *, select_filter: str | None, dry_run: bool) -> None:
    """Let the operator browse the roster and manually build merge groups."""
    target = normalize_player_name(select_filter) if select_filter else None
    while True:
        players = session.query(Player).order_by(Player.display_name).all()
        if target:
            players = [player for player in players if normalize_player_name(player.display_name).startswith(target)]
        if not players:
            click.echo("No players match the given filter.")
            return

        click.echo("\nPlayers:")
        for index, player in enumerate(players, start=1):
            click.echo(f"  [{index}] {player.display_name} ({len(player.participations)} events)")

        raw = click.prompt("Enter 2+ numbers to merge (comma-separated), or blank to stop", default="", show_default=False)
        if not raw.strip():
            return

        try:
            indices = [int(part.strip()) for part in raw.split(",") if part.strip()]
            group = [players[index - 1] for index in indices]
        except (ValueError, IndexError):
            click.echo("Invalid selection — try again.")
            continue

        if len(group) < 2:
            click.echo("Select at least 2 players.")
            continue

        review_group(session, "Selected group", group, dry_run=dry_run)
```

Add `normalize_player_name` to the existing `from mm_ladder.services.player_matching import ...`
line at the top of `consolidation.py` so it reads:

```python
from mm_ladder.services.player_matching import name_tokens, normalize_player_name
```

- [ ] **Step 2: Register the CLI command**

In `backend/migration/cli.py`, add `run_auto_consolidation` and `run_select_consolidation` to the
existing `from migration.importer import run_import, seed_cups` import line — actually they live in
`migration.consolidation`, so add a new import line instead, alongside the existing
`migration.importer` import (around line 8):

```python
from migration.consolidation import run_auto_consolidation, run_select_consolidation
```

Append the command at the end of `backend/migration/cli.py`, just before the
`if __name__ == "__main__":` block:

```python
@cli.command("consolidate-players")
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
@click.option("--dry-run", is_flag=True, default=False, help="Print planned merges without writing to the database.")
@click.option(
    "--select",
    "select_mode",
    is_flag=True,
    default=False,
    help="Manually pick players to merge from a browsable list instead of auto-detecting groups.",
)
@click.option(
    "--select-filter",
    default=None,
    help='With --select, only list players whose name starts with this string (case/accent-insensitive, e.g. "dam").',
)
def consolidate_players_cmd(db: str, dry_run: bool, select_mode: bool, select_filter: str | None) -> None:
    """Find and interactively merge duplicate player records, recording alternate spellings as aliases."""
    session = _make_session(db)
    try:
        if select_mode:
            run_select_consolidation(session, select_filter=select_filter, dry_run=dry_run)
        else:
            run_auto_consolidation(session, dry_run=dry_run)
    except Exception as e:
        session.rollback()
        log.error("consolidate-players failed", error=str(e))
        raise SystemExit(1) from None
    finally:
        session.close()
```

- [ ] **Step 3: Smoke-test the command against a copy of the dev database**

Run (from `backend/`, using PowerShell's copy so the real DB is untouched):

```powershell
Copy-Item mm_ladder.db mm_ladder.consolidate-test.db -Force
poetry run python -m migration.cli consolidate-players --db mm_ladder.consolidate-test.db --dry-run
```

Expected: the command prints "Found N candidate group(s)." (N >= 1, since the real DB contains the
Norton-Smith and Damian groups found during design research), walks through each group showing
numbered members with the proposed survivor marked, accepts your input at the
"Exclude any... " prompt, prints a plan, and ends each group with "(dry run — no changes made)"
without writing anything.

Then try select mode:

```powershell
poetry run python -m migration.cli consolidate-players --db mm_ladder.consolidate-test.db --select --select-filter dam --dry-run
```

Expected: prints only players whose name starts with "dam"/"Dam"/"Damián" (accent-insensitive),
lets you enter e.g. `1,2,3` to build a group, and previews the same plan/conflict output.

Clean up afterwards:

```powershell
Remove-Item mm_ladder.consolidate-test.db
```

- [ ] **Step 4: Run the full backend test suite**

Run: `poetry run tox`
Expected: all tests pass (per project convention — see `feedback_test_command` — `tox` is used
instead of running `pytest` directly, since it also runs `pyright`)

- [ ] **Step 5: Commit**

```bash
git add backend/migration/consolidation.py backend/migration/cli.py
git commit -m "feat(migration): add consolidate-players CLI command"
```

---

## Verification summary

After Task 9, run end-to-end against a **copy** of the real database (never the original — this
command deletes rows):

```powershell
cd backend
Copy-Item mm_ladder.db mm_ladder.consolidate-test.db -Force
poetry run python -m migration.cli consolidate-players --db mm_ladder.consolidate-test.db --dry-run
```

Confirm:
- The "Alex Norton - Smith" / "Alex Norton-Smith" group and the "Damian Cengarle Barilari" /
  "Damián Cengarle" / "Damian C" group are both detected and grouped correctly.
- Excluding a member from a group correctly drops it from the plan.
- The conflict pre-check correctly skips groups with shared-tournament or head-to-head conflicts
  (none are expected to exist in the current dataset, so this is mainly confirmed by the unit
  tests in Task 7 — but if any group in the live data triggers it, verify the explanation names
  the right players/tournament).
- `--select --select-filter dam` narrows the roster correctly and lets you build a manual group.

Then run it for real (without `--dry-run`) against the **copy**, confirm the merges look right
(`aliases` populated, row counts match the dry-run preview, players gone from the list), and only
then run it against the real `mm_ladder.db`.
