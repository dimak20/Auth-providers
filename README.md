# Auth-providers

A FastAPI backend and a React frontend for comparing three authentication providers: **Auth0**, **Supabase** and **Keycloak**. The frontend switches between them on the fly, and the backend verifies the selected provider's JWTs via JWKS.

## Documentation

- [Setting up Auth0, Supabase and Keycloak from scratch](docs/setup-guide.md) — step by step with screenshots, plus a provider comparison and troubleshooting
- [PDF version](docs/auth-providers-setup.pdf)
- [Deploying to AWS: ECS Fargate + ALB + RDS + Amplify](docs/ecs/ecs-guide.md) — every console step with screenshots, pitfalls and notes for Terraform ([PDF](docs/ecs/ecs-guide.pdf))
- [The same stack in Terraform: prod-only and stage + prod](docs/terraform/terraform-guide.md) — modules, GitHub Actions CD with OIDC and approval, pitfalls ([PDF](docs/terraform/terraform-guide.pdf))

## Structure

- `src/` — backend (FastAPI, SQLAlchemy, Alembic)
- `frontend/` — frontend (React, Vite, Tailwind)
- `docs/` — provider setup guide, AWS console deployment guide (`docs/ecs/`), Terraform guide (`docs/terraform/`)
- `infra/` — Terraform: `prod-only/` and `multi-env/` (stage + prod), see [infra/README.md](infra/README.md)
