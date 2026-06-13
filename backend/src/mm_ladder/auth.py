import hmac
import os
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from fastapi import status as http_status


def require_admin(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    """Reject the request unless X-Admin-Token matches the ADMIN_TOKEN env var.

    Fails closed: if ADMIN_TOKEN is unset or empty, all writes are rejected.
    """
    expected = os.getenv("ADMIN_TOKEN")
    if not expected or not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing admin token")


AdminDep = Depends(require_admin)
