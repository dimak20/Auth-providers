# Infrastructure (Terraform)

Two independent layouts of the same AWS stack (ECS Fargate + ALB + RDS + Valkey Serverless + S3 media + Amplify,
eu-west-1).
Use **one of them at a time**: both create resources with overlapping names (ECR repository, GitHub OIDC
provider, Route 53 records).

Created by hand, outside Terraform (read via `data`): Route 53 hosted zone `dimak-auth.xyz`,
ACM certificate `dimak-auth.xyz` + `*.dimak-auth.xyz`, S3 state bucket.

```
infra/
  prod-only/                 # one environment, everything in one root
  multi-env/
    modules/app/             # the whole environment as a module
    envs/shared/             # ECR repository + GitHub OIDC provider (one per account)
    envs/stage/              # module "app" → api-stage / app-stage.dimak-auth.xyz, 10.1.0.0/16
    envs/prod/               # module "app" → api / app.dimak-auth.xyz,             10.0.0.0/16
```

| Root | State key | CD workflow |
|---|---|---|
| `prod-only` | `prod-only/terraform.tfstate` | `.github/workflows/deploy-prod-only.yml` (manual) |
| `multi-env/envs/shared` | `shared/terraform.tfstate` | — |
| `multi-env/envs/stage` | `stage/terraform.tfstate` | `.github/workflows/deploy.yml` |
| `multi-env/envs/prod` | `prod/terraform.tfstate` | `.github/workflows/deploy.yml` (after approval) |

## Inputs

- `terraform.tfvars` (committed): `supabase_ref`, `supabase_publishable_key`, `image_tag`.
- `private.auto.tfvars` (gitignored): `alert_email`, `github_token` (classic PAT, scope `repo`; only needed
  while the Amplify app is created, revoke it afterwards).
- Requires Terraform ≥ 1.15 for `aws login` credentials (`profile = "dev"`) and the `hashicorp/random` provider
  (Valkey password; `terraform init -upgrade` after pulling).

## multi-env: bring up

```powershell
cd infra/multi-env/envs/shared; terraform init; terraform apply
# push the first image to ECR (tag = image_tag in stage/prod terraform.tfvars)
cd ../stage; terraform init; terraform apply
cd ../prod;  terraform init; terraform apply
```

Then:

1. Supabase → Authentication → URL Configuration → Redirect URLs: add `https://app-stage.dimak-auth.xyz`.
2. GitHub → Settings → Environments:
   - `staging`: variable `AWS_ROLE_ARN` = `terraform output github_deploy_role_arn` (stage);
   - `production`: variables `AWS_ROLE_ARN` (prod) and `AMPLIFY_APP_ID` = `terraform output amplify_app_id` (prod),
     protection rule **Required reviewers**.
3. First frontend builds: stage builds on the next push; prod is released by the workflow
   (or `aws amplify start-job --app-id <id> --branch-name main --job-type RELEASE`).

The deploy roles trust only their GitHub Environment:
`repo:dimak20@87275887/Auth-providers@1457050471:environment:staging|production`
(the repo uses immutable OIDC subject claims, hence the numeric ids).

## Tear down

Reverse order: `prod` → `stage` → `shared`, each with `terraform destroy`
(`db_deletion_protection` must be `false`). The hosted zone, certificate and state bucket stay.
