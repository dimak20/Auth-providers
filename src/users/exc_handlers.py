from fastapi import Request
from fastapi.responses import JSONResponse

from src.users.exceptions import InsufficientScopeException, InvalidTokenException


async def invalid_token(request: Request, exc: InvalidTokenException):
    return JSONResponse({"detail": "Invalid token"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})

async def insufficient_scope(request: Request, exc: InsufficientScopeException):
    return JSONResponse({"detail": "Insufficient scope"}, status_code=403)
