from migration.seasons import season_dir_name


def test_season_dir_name_formats_correctly() -> None:
    season = {
        "id": 33,
        "set_code": "mkm",
        "starts_on": "2024-02-02",
        "ends_on": "2024-04-11",
    }
    assert season_dir_name(season) == "season_33_mkm_24-02-02_24-04-11"


def test_season_dir_name_single_digit_month() -> None:
    season = {
        "id": 7,
        "set_code": "soi",
        "starts_on": "2016-04-02",
        "ends_on": "2016-07-15",
    }
    assert season_dir_name(season) == "season_7_soi_16-04-02_16-07-15"


def test_season_dir_name_tdm() -> None:
    season = {
        "id": 39,
        "set_code": "tdm",
        "starts_on": "2025-04-04",
        "ends_on": "2025-06-05",
    }
    assert season_dir_name(season) == "season_39_tdm_25-04-04_25-06-05"
