# mm-ladder — Backend

Python service layer for the mm-ladder mono-repo.

## Prerequisites

**Python version manager** — pick one:

| Tool | Platforms | Notes |
|------|-----------|-------|
| [mise](https://mise.jdx.dev/) | Windows, macOS, Linux | Recommended — reads `.tool-versions` natively |
| [asdf](https://asdf-vm.com/) | macOS, Linux | Add the `python` plugin |
| [pyenv-win](https://github.com/pyenv-win/pyenv-win) | Windows | Python only, set version manually |

**Package manager:** [Poetry](https://python-poetry.org/docs/#installation) (official installer or `pipx`)

## Setup

### macOS / Linux (asdf)

```bash
asdf install
poetry env use $(asdf which python)
poetry install
```

### Windows (mise)

```powershell
mise install          
poetry env use $(mise which python)
poetry install
```

## Running the toolchain

```bash
poetry run tox                    # lint + typecheck + test (full suite)
poetry run pytest -v              # tests only
poetry run ruff check src tests   # lint only
poetry run pyright src            # type-check only
```

## CHANGELOG

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- All unreleased changes go under `## [Unreleased]`.
- On release, rename `[Unreleased]` to `[M.m.p] - YYYY-MM-DD` and add a fresh `## [Unreleased]` section above it.
