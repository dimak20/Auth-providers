import asyncio
from collections.abc import Callable
from typing import Any

import jwt
from fastapi import Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, SecurityScopes
from jwt import PyJWKClient

from src.users.exceptions import InsufficientScopeException, InvalidTokenException
from src.users.interfaces import AuthClient


class JWKCloudAuthClient:
    def __init__(
        self,
        domain: str,
        issuer: str,
        audience: str,
        issuer_path: str,
        algorithms: list
) -> None:
        self._domain = domain
        self._issuer = issuer
        self._issuer_path = issuer_path
        self._audience = audience
        self._algorithms = algorithms
        self.client = None

    async def init_client(self):
        self.client = PyJWKClient(f"{self._issuer}{self._issuer_path}")
        await asyncio.to_thread(self.client.get_jwk_set)

    async def get_signing_key(self, token: str) -> Any:
        if self.client is None:
            raise RuntimeError("auth client is not set up")
        return (await asyncio.to_thread(self.client.get_signing_key_from_jwt, token=token)).key

    async def decode(self, token: str) -> dict[str, Any]:
        try:
            signing_key = await self.get_signing_key(token=token)
            return jwt.decode(
                token,
                signing_key,
                algorithms=self._algorithms,
                audience=self._audience,
                issuer=self._issuer,
                leeway=10,
                options={"require": ["exp", "iat", "iss", "aud","sub"]}
            )
        except jwt.PyJWTError as e:
            raise InvalidTokenException("invalid token") from e

class JWKSelfhostedAuthClient:
    def __init__(
        self,
        domain: str,
        issuer: str,
        audience: str,
        issuer_path: str,
        algorithms: list
) -> None:
        self._domain = domain
        self._issuer = issuer
        self._issuer_path = issuer_path
        self._audience = audience
        self._algorithms = algorithms
        self.client = None

    async def init_client(self):
        self.client = PyJWKClient(self._issuer_path)
        await asyncio.to_thread(self.client.get_jwk_set)

    async def get_signing_key(self, token: str) -> Any:
        if self.client is None:
            raise RuntimeError("auth client is not set up")
        return (await asyncio.to_thread(self.client.get_signing_key_from_jwt, token=token)).key

    async def decode(self, token: str) -> dict[str, Any]:
        try:
            signing_key = await self.get_signing_key(token=token)
            return jwt.decode(
                token,
                signing_key,
                algorithms=self._algorithms,
                audience=self._audience,
                issuer=self._issuer,
                leeway=10,
                options={"require": ["exp", "iat", "iss", "aud","sub"]}
            )
        except jwt.PyJWTError as e:
            raise InvalidTokenException("invalid token") from e

bearer = Security(HTTPBearer())
async def verify_token(
        request: Request,
        security_scopes: SecurityScopes,
        creds: HTTPAuthorizationCredentials = bearer,

) -> dict:
    auth: AuthClient = request.app.state.auth
    payload = await auth.decode(token=creds.credentials)

    granted = set(payload.get("scope", "").split() + payload.get("permissions", []))
    if not set(security_scopes.scopes) <= granted:
        raise InsufficientScopeException("insufficient scope")
    return payload

AUTH_CLIENTS: dict[str, Callable[..., AuthClient]] = {
    "auth0": JWKCloudAuthClient,
    "supabase": JWKCloudAuthClient,
    "keycloak": JWKSelfhostedAuthClient,
}
