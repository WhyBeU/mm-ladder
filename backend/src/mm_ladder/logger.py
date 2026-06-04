import logging
import sys
from pathlib import Path

import structlog


class _Tee:
    """Write to multiple text streams simultaneously."""

    def __init__(self, *streams: object) -> None:
        self._streams = streams

    def write(self, s: str) -> int:
        for stream in self._streams:
            stream.write(s)  # type: ignore[union-attr]
        return len(s)

    def flush(self) -> None:
        for stream in self._streams:
            stream.flush()  # type: ignore[union-attr]


def configure_logging(*, dev: bool = True, log_file: Path | None = None) -> None:
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if dev:
        processors: list[structlog.types.Processor] = shared_processors + [
            structlog.dev.ConsoleRenderer(),
        ]
        log_level = logging.DEBUG
    else:
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
        log_level = logging.INFO

    if log_file is not None:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        sink = _Tee(sys.stdout, open(log_file, "w", encoding="utf-8"))  # noqa: SIM115
    else:
        sink = sys.stdout

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(sink),  # type: ignore[arg-type]
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.types.FilteringBoundLogger:
    return structlog.get_logger(name)
