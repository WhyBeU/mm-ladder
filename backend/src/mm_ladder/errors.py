from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError


class NotFoundError(Exception):
    def __init__(self, resource: str, id: int) -> None:
        self.resource = resource
        self.id = id
        super().__init__(f"{resource} {id} not found")


class ConflictError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, NotFoundError)
    return JSONResponse(status_code=404, content={"detail": f"{exc.resource} {exc.id} not found"})


async def conflict_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ConflictError)
    return JSONResponse(status_code=409, content={"detail": exc.message})


async def integrity_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, IntegrityError)
    return JSONResponse(status_code=409, content={"detail": "Conflict: unique constraint violation"})
