from datetime import date, timedelta

# Canonical scoring mapping lives in the app package; re-exported here for the migration
# tooling's existing importers and tests. The app must not depend on migration/ code.
from mm_ladder.scoring import POINTS_TO_WLD

# Seasons starting on/after War of the Spark switched qualification from total
# points to "best N event scores"; earlier seasons qualified on points.
BEST_QUALIFYING_FROM = date(2019, 4, 27)

__all__ = ["BEST_QUALIFYING_FROM", "POINTS_TO_WLD", "SEASONS", "season_dir_name"]

# cup_year: which yearly cup this season contributes to.
# qualifying: False marks non-qualifying seasons (e.g. holiday) — defaults to True.
# qualifier_count: overrides the default 2 qualifying slots.
SEASONS: list[dict] = [
    # ── 2016 cup ────────────────────────────────────────────────────────────────
    {"id": 7,  "name": "Shadows over Innistrad",                  "set_code": "soi", "starts_on": "2016-04-02", "ends_on": "2016-07-15", "cup_year": 2016},
    {"id": 6,  "name": "Eldritch Moon",                           "set_code": "emn", "starts_on": "2016-07-16", "ends_on": "2016-09-22", "cup_year": 2016},
    # ── 2017 cup ────────────────────────────────────────────────────────────────
    {"id": 5,  "name": "Kaladesh",                                "set_code": "kld", "starts_on": "2016-09-24", "ends_on": "2017-01-13", "cup_year": 2017},
    {"id": 4,  "name": "Aether Revolt",                           "set_code": "aer", "starts_on": "2017-01-14", "ends_on": "2017-04-21", "cup_year": 2017},
    {"id": 3,  "name": "Amonkhet",                                "set_code": "akh", "starts_on": "2017-04-22", "ends_on": "2017-07-07", "cup_year": 2017},
    {"id": 2,  "name": "Hour of Devastation",                     "set_code": "hou", "starts_on": "2017-07-08", "ends_on": "2017-09-22", "cup_year": 2017},
    # ── 2018 cup ────────────────────────────────────────────────────────────────
    {"id": 1,  "name": "Ixalan",                                  "set_code": "xln", "starts_on": "2017-09-23", "ends_on": "2018-01-12", "cup_year": 2018},
    {"id": 8,  "name": "Rivals of Ixalan",                        "set_code": "rix", "starts_on": "2018-01-13", "ends_on": "2018-04-20", "cup_year": 2018},
    {"id": 9,  "name": "Dominaria",                               "set_code": "dom", "starts_on": "2018-04-21", "ends_on": "2018-07-06", "cup_year": 2018},
    {"id": 10, "name": "Core 2019",                               "set_code": "m19", "starts_on": "2018-07-07", "ends_on": "2018-09-28", "cup_year": 2018},
    # ── 2019 cup ────────────────────────────────────────────────────────────────
    {"id": 11, "name": "Guilds of Ravnica",                       "set_code": "grn", "starts_on": "2018-09-29", "ends_on": "2019-01-18", "cup_year": 2019},
    {"id": 12, "name": "Ravnica Allegiance",                      "set_code": "rna", "starts_on": "2019-01-19", "ends_on": "2019-04-26", "cup_year": 2019},
    {"id": 13, "name": "War of the Spark",                        "set_code": "war", "starts_on": "2019-04-27", "ends_on": "2019-07-04", "cup_year": 2019},
    {"id": 14, "name": "Core Set 2020",                           "set_code": "m20", "starts_on": "2019-07-05", "ends_on": "2019-09-26", "cup_year": 2019},
    # ── 2020 cup ────────────────────────────────────────────────────────────────
    {"id": 15, "name": "Throne of Eldraine",                      "set_code": "eld", "starts_on": "2019-09-27", "ends_on": "2020-01-16", "cup_year": 2020},
    {"id": 16, "name": "Theros Beyond Death",                     "set_code": "thb", "starts_on": "2020-01-17", "ends_on": "2020-04-17", "cup_year": 2020},
    {"id": 17, "name": "Ikoria: Lair of Behemoths",               "set_code": "iko", "starts_on": "2020-04-16", "ends_on": "2020-06-26", "cup_year": 2020},
    {"id": 18, "name": "Core Set 2021",                           "set_code": "m21", "starts_on": "2020-06-26", "ends_on": "2020-09-18", "cup_year": 2020},
    # ── 2021 cup ────────────────────────────────────────────────────────────────
    {"id": 19, "name": "Zendikar Rising",                         "set_code": "znr", "starts_on": "2020-09-19", "ends_on": "2021-01-22", "cup_year": 2021},
    {"id": 20, "name": "Kaldheim",                                "set_code": "khm", "starts_on": "2021-01-29", "ends_on": "2021-04-16", "cup_year": 2021},
    {"id": 21, "name": "Strixhaven",                              "set_code": "stx", "starts_on": "2021-04-24", "ends_on": "2021-07-16", "cup_year": 2021},
    {"id": 22, "name": "D&D: Adventures in the Forgotten Realms", "set_code": "afr", "starts_on": "2021-07-17", "ends_on": "2021-09-17", "cup_year": 2021},
    # ── 2022 cup ────────────────────────────────────────────────────────────────
    {"id": 23, "name": "Innistrad: Midnight Hunt",                "set_code": "mid", "starts_on": "2021-09-18", "ends_on": "2021-11-19", "cup_year": 2022},
    {"id": 24, "name": "Innistrad: Crimson Vow",                  "set_code": "vow", "starts_on": "2021-11-12", "ends_on": "2022-02-11", "cup_year": 2022},
    {"id": 25, "name": "Kamigawa: Neon Dynasty",                  "set_code": "neo", "starts_on": "2022-02-12", "ends_on": "2022-04-22", "cup_year": 2022},
    {"id": 26, "name": "Streets of New Capenna",                  "set_code": "snc", "starts_on": "2022-04-23", "ends_on": "2022-09-02", "cup_year": 2022},
    # ── 2023 cup ────────────────────────────────────────────────────────────────
    {"id": 27, "name": "Dominaria United",                        "set_code": "dmu", "starts_on": "2022-09-02", "ends_on": "2022-11-11", "cup_year": 2023},
    {"id": 28, "name": "The Brothers' War",                       "set_code": "bro", "starts_on": "2022-11-11", "ends_on": "2023-02-03", "cup_year": 2023},
    {"id": 29, "name": "All Will Be One",                         "set_code": "one", "starts_on": "2023-02-04", "ends_on": "2023-04-13", "cup_year": 2023},
    {"id": 30, "name": "March of the Machine",                    "set_code": "mom", "starts_on": "2023-04-14", "ends_on": "2023-09-01", "cup_year": 2023},
    # ── 2024 cup ────────────────────────────────────────────────────────────────
    {"id": 31, "name": "Wilds of Eldraine",                       "set_code": "woe", "starts_on": "2023-09-01", "ends_on": "2023-11-09", "cup_year": 2024},
    {"id": 32, "name": "The Lost Caverns of Ixalan",              "set_code": "lci", "starts_on": "2023-11-10", "ends_on": "2024-02-01", "cup_year": 2024},
    {"id": 33, "name": "Murders at Karlov Manor",                 "set_code": "mkm", "starts_on": "2024-02-02", "ends_on": "2024-04-11", "cup_year": 2024},
    {"id": 34, "name": "Outlaws of Thunder Junction",             "set_code": "otj", "starts_on": "2024-04-12", "ends_on": "2024-07-25", "cup_year": 2024},
    # ── 2025 cup ────────────────────────────────────────────────────────────────
    {"id": 35, "name": "Bloomburrow",                             "set_code": "blb", "starts_on": "2024-07-26", "ends_on": "2024-09-19", "cup_year": 2025},
    {"id": 36, "name": "Duskmourn",                               "set_code": "dsk", "starts_on": "2024-09-23", "ends_on": "2024-12-20", "cup_year": 2025},
    {"id": 37, "name": "Holiday Season 2024-2025",                "set_code": "p01", "starts_on": "2024-12-23", "ends_on": "2025-02-09", "cup_year": 2025, "qualifying": False},
    {"id": 38, "name": "Aetherdrift",                             "set_code": "dft", "starts_on": "2025-02-10", "ends_on": "2025-04-06", "cup_year": 2025},
    {"id": 39, "name": "Tarkir: Dragonstorm",                     "set_code": "tdm", "starts_on": "2025-04-04", "ends_on": "2025-06-05", "cup_year": 2025},
    # ── 2026 cup ────────────────────────────────────────────────────────────────
    {"id": 40, "name": "Final Fantasy",                           "set_code": "fin", "starts_on": "2025-06-09", "ends_on": "2025-07-27", "cup_year": 2026, "qualifier_count": 1},
    {"id": 41, "name": "Edge of Eternities",                      "set_code": "eoe", "starts_on": "2025-07-28", "ends_on": "2025-09-21", "cup_year": 2026, "qualifier_count": 1},
    {"id": 42, "name": "Marvel's Spider-Man",                     "set_code": "spm", "starts_on": "2025-09-22", "ends_on": "2025-11-16", "cup_year": 2026, "qualifying": False},
    {"id": 43, "name": "Avatar: The Last Airbender",              "set_code": "tla", "starts_on": "2025-11-17", "ends_on": "2026-01-18", "cup_year": 2026, "qualifying": False},
    {"id": 44, "name": "Lorwyn Eclipsed",                         "set_code": "ecl", "starts_on": "2026-01-19", "ends_on": "2026-04-17", "cup_year": 2026},
    {"id": 45, "name": "Secrets of Strixhaven",                   "set_code": "sos", "starts_on": "2026-04-20", "ends_on": "2026-07-31", "cup_year": 2026},
]


def season_dir_name(season: dict) -> str:
    start = date.fromisoformat(season["starts_on"]).strftime("%y-%m-%d")
    end = date.fromisoformat(season["ends_on"]).strftime("%y-%m-%d")
    return f"season_{season['id']}_{season['set_code']}_{start}_{end}"


def get_mondays(starts_on: date, ends_on: date) -> list[date]:
    """Return all Mondays (weekday=0) within [starts_on, ends_on] inclusive."""
    mondays: list[date] = []
    d = starts_on
    while d.weekday() != 0:
        d += timedelta(days=1)
    while d <= ends_on:
        mondays.append(d)
        d += timedelta(weeks=1)
    return mondays
