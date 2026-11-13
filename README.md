# Auth-providers

A FastAPI backend and a React frontend for comparing three authentication providers: **Auth0**, **Supabase** and **Keycloak**. The frontend switches between them on the fly, and the backend verifies the selected provider's JWTs via JWKS.

## Documentation

- [Setting up Auth0, Supabase and Keycloak from scratch](docs/setup-guide.md) — step by step with screenshots, plus a provider comparison and troubleshooting
- [PDF version](docs/auth-providers-setup.pdf)

## Structure

- `src/` — backend (FastAPI, SQLAlchemy, Alembic)
- `frontend/` — frontend (React, Vite, Tailwind)
- `docs/` — provider setup guide
