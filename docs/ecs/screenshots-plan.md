# ECS guide: screenshot plan

Goal: console screenshots of every step from `docs/ecs-setup-log.md`, masked, saved as PNG in
`docs/ecs/images/`, then turned into `docs/ecs/ecs-guide.md` + PDF (same pipeline as `docs/setup-guide.md`).

Status legend: `[ ]` todo, `[x]` done, `[-]` skipped (reason next to it).

## Masking rules

- AWS account id → `123456789012` / `1234-5678-9012` (in ARNs, URLs, headers).
- Email local parts → `•••••@domain`; names, usernames and display names → `•••••`.
- Keys and secrets: `sb_publishable_…`, `sb_secret_…`, `GOCSPX-…`, secret values, access keys → `••••`.
- Avatars in console headers → blurred.
- Never open the *Retrieve secret value* view of the RDS secret.
- Done in-page (DOM text replace) before the screenshot; avatars and anything left blurred afterwards with PIL.

## Naming

`NN-<area>-<what>.png`, `NN` follows the guide order.

## Checklist

### Account, DNS, TLS
- [x] 01-route53-hosted-zone — zone `dimak-auth.xyz`, records (NS, SOA, ACM CNAME, `api` A-alias, Amplify records)
- [x] 02-acm-certificate — certificate `ISSUED`, both names `SUCCESS`, DNS validation

### Terraform state
- [x] 03-s3-tfstate-bucket — bucket properties: versioning Enabled, encryption, Block public access

### ECR
- [x] 04-ecr-repository — Summary tab: immutable tags, AES-256, scan on push
- [x] 05-ecr-images — single tagged image per push, scan results
- [x] 06-ecr-lifecycle — rule: count > 10, tag status any

### VPC
- [x] 07-vpc-subnets — 4 subnets with CIDRs and AZs
- [x] 08-vpc-route-public — `auth-public`: routes (0.0.0.0/0 → IGW)
- [x] 09-vpc-route-public-assoc — `auth-public`: explicit subnet associations
- [x] 10-vpc-route-private — `auth-private`: routes (0.0.0.0/0 → NAT, S3 prefix list → endpoint)
- [x] 10b-vpc-route-private-assoc — `auth-private`: explicit subnet associations
- [x] 11-vpc-nat — NAT gateway (regional) available
- [x] 12-vpc-igw — Internet gateway attached
- [x] 13-vpc-endpoint-s3 — S3 gateway endpoint on `auth-private`
- [x] 14-sg-alb — inbound 80/443 from 0.0.0.0/0
- [x] 15-sg-api — inbound 8000 from `auth-providers-alb`
- [x] 16-sg-rds — inbound 5432 from `auth-providers-api`

### RDS
- [x] 17-rds-subnet-group — `auth-private-db`, private subnets
- [x] 18-rds-connectivity — instance: endpoint, VPC, subnet group, SG, not public
- [x] 18b-rds-security-group-rules — SG rules on the instance page
- [x] 19-rds-configuration — engine, class, storage, Secrets Manager credentials
- [x] 20-rds-maintenance-backups — retention 7 days, deletion protection

### Config and secrets
- [x] 21-secrets-manager-rds — RDS-managed secret overview (no value!)
- [x] 22-ssm-parameters — list under `/auth-providers/api/`

### IAM
- [x] 23-iam-exec-role-permissions — managed policy + inline `read-db-secret`
- [x] 24-iam-exec-role-inline-json — inline policy JSON
- [x] 25-iam-exec-role-trust — trust relationship `ecs-tasks.amazonaws.com`

### ECS
- [x] 26-ecs-cluster — cluster, Fargate capacity providers
- [x] 27-ecs-taskdef-overview — CPU/memory, roles, network mode
- [x] 28-ecs-taskdef-container — image, port mapping
- [x] 28b-ecs-taskdef-network — container network settings
- [x] 28c-ecs-taskdef-logging — awslogs options
- [x] 29-ecs-taskdef-secrets — env vars as ValueFrom (SSM + Secrets Manager)
- [x] 30-ecs-service-overview — running 2/2, revision, deployment completed
- [x] 31-ecs-service-networking — private subnets, SG, public IP off
- [x] 32-ecs-service-lb — ALB / target group / container port
- [x] 33-ecs-service-deployment — capacity provider strategy, circuit breaker
- [x] 33b-ecs-service-deployments — deployments history
- [x] 34-ecs-service-autoscaling — min 2 / max 4, cpu-60

### Load balancing
- [x] 35-target-group — type IP, HTTP 8000, health check `/healthz`
- [x] 36-target-group-health — targets healthy
- [x] 37-alb-overview — internet-facing, public subnets, SG
- [x] 38-alb-listeners — 443 forward + cert, 80 redirect 301
- [x] 39-route53-api-record — record details panel: A, alias → ALB, evaluate target health

### Observability
- [x] 40-cloudwatch-log-group — `/ecs/auth-providers-api`, retention 1 month
- [x] 41-sns-topic — topic + confirmed email subscription
- [x] 42-cloudwatch-alarm — `api-5xx` on `HTTPCode_Target_5XX_Count`

### Frontend
- [x] 43-amplify-app — app overview, branch `main`
- [x] 44-amplify-build-settings — Hosting → Build settings (sidebar click; direct URL redirects)
- [x] 45-amplify-env-vars — `VITE_*` variables
- [x] 46-amplify-custom-domain — `app.dimak-auth.xyz`
- [x] 47-supabase-url-config — Site URL / Redirect URLs

### Result
- [x] 48-app-working — app.dimak-auth.xyz signed in
- [x] 49-api-healthz — `https://api.dimak-auth.xyz/healthz` → ok

### Output
- [x] process images (crop, blur avatars) → `docs/ecs/images/`
- [x] write `docs/ecs/ecs-guide.md` from `docs/ecs-setup-log.md` with the images
- [x] build `docs/ecs/ecs-guide.pdf`
- [x] link from `README.md`

## Status

- Done. 54 screenshots in `docs/ecs/images/`, guide `docs/ecs/ecs-guide.md` + `ecs-guide.pdf`, linked from `README.md`.
- Processing: in-page DOM masking before each shot (iframe-aware), then PIL: Supabase avatar blurred, the floating
  browser-extension button erased where it was isolated, long empty bands under the content collapsed.
- `.playwright-mcp/` (raw shots + unmasked page snapshots) deleted.
