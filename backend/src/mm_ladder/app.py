import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from mm_ladder.db import make_engine, make_session_factory
from mm_ladder.errors import ConflictError, NotFoundError, conflict_handler, integrity_error_handler, not_found_handler
from mm_ladder.logger import configure_logging
from mm_ladder.routes.player import router as player_router
from mm_ladder.routes.season import router as season_router
from mm_ladder.routes.tournament import router as tournament_router
from mm_ladder.routes.yearly_cup import router as yearly_cup_router

_health_router = APIRouter(tags=["health"])


@_health_router.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging(dev=os.getenv("ENV", "development") == "development")
    engine = make_engine(os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./mm_ladder.db"))
    app.state.session_factory = make_session_factory(engine)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="mm-ladder API",
        version="0.2.0",
        description="Draft league ladder tracker for Magic Mates Monday",
        lifespan=lifespan,
    )

    # Exception handlers
    app.add_exception_handler(NotFoundError, not_found_handler)  # type: ignore[arg-type]
    app.add_exception_handler(ConflictError, conflict_handler)  # type: ignore[arg-type]
    app.add_exception_handler(IntegrityError, integrity_error_handler)  # type: ignore[arg-type]

    # Routers
    app.include_router(_health_router)
    app.include_router(player_router)
    app.include_router(yearly_cup_router)
    app.include_router(season_router)
    app.include_router(tournament_router)

    return app


app = create_app()
