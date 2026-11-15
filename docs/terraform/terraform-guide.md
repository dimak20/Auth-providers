# Auth-providers on AWS with Terraform (prod-only and stage + prod)

How the AWS stack from the [console guide](../ecs/ecs-guide.md) is described in Terraform, deployed, released by
GitHub Actions and split into two environments. Everything below was done on a real account; every pitfall listed
was actually hit.

Placeholders:

| Placeholder | Meaning |
|---|---|
| `<account-id>` | 12-digit AWS account id |
| `<ref>` | Supabase project ref |
| `<owner>` / `<owner-id>` | GitHub repository owner and its numeric id |
| `<repo-id>` | numeric id of the GitHub repository |

## Contents

1. [What Terraform manages and what it doesn't](#1-what-terraform-manages-and-what-it-doesnt)
2. [Prerequisites](#2-prerequisites)
3. [Repository layout](#3-repository-layout)
4. [prod-only: the stack step by step](#4-prod-only-the-stack-step-by-step)
5. [First image, first apply, first frontend build](#5-first-image-first-apply-first-frontend-build)
6. [CD with GitHub Actions and OIDC](#6-cd-with-github-actions-and-oidc)
7. [multi-env: stage + prod](#7-multi-env-stage--prod)
8. [CD for stage → prod with approval](#8-cd-for-stage--prod-with-approval)
9. [Running and tearing down](#9-running-and-tearing-down)
10. [Pitfalls and fixes](#10-pitfalls-and-fixes)
11. [Costs](#11-costs)
12. [Concepts cheat sheet](#12-concepts-cheat-sheet)

---

## 1. What Terraform manages and what it doesn't

Created **once by hand** and only read by Terraform through `data` sources. They survive every
`terraform destroy`:

| Resource | Why it stays out of Terraform |
|---|---|
| Route 53 hosted zone `dimak-auth.xyz` | a new zone gets new NS servers, which would have to be changed at the registrar every rebuild |
| ACM certificate `dimak-auth.xyz` + `*.dimak-auth.xyz` | DNS-validated once; its validation CNAME stays in the zone so it keeps renewing |
| S3 bucket `dimak-auth-tfstate-<account-id>` | Terraform can't keep its state in a bucket it creates itself |
| AWS Amplify GitHub App installation on the repo | GitHub requires a human to approve an app installation in the browser |

Everything else (VPC, RDS, Valkey cache, S3 media bucket, ECS, ALB, DNS records, SSM, IAM, ECR, Amplify app, alerts,
GitHub deploy role) is in Terraform.

## 2. Prerequisites

- **Terraform ≥ 1.15.** Credentials come from `aws login --profile dev` (browser sign-in, short-lived keys).
  Terraform 1.14 does not understand the `login_session` profile and fails `init` with
  `No valid credential sources found … no EC2 IMDS role found`. Upgrade (`choco upgrade terraform`) or use a bridge
  profile:
  ```ini
  [profile dev-tf]
  region = eu-west-1
  credential_process = aws configure export-credentials --profile dev --format process
  ```
  When the `aws login` session expires, commands fail with *Your session has expired*: run `aws login` again.
- AWS provider `~> 6.0` (regional NAT gateway support) and `hashicorp/random ~> 3.6` (the Valkey password).
- The manual resources from §1. The console guide (§3 DNS, §5 state bucket, §6 ACM) shows how to create them.
- The AWS Amplify GitHub App installed on the repository: open
  `https://github.com/apps/aws-amplify-eu-west-1/installations/new` → your account → **Only select repositories**
  → this repo → **Install**. Check later in GitHub → Settings → Applications → Installed GitHub Apps.
- A GitHub personal access token (classic, scope `repo`) — only while the Amplify app is being created; revoke it
  afterwards.
- Docker (to push the first image).

## 3. Repository layout

```
infra/
  README.md
  prod-only/                   # one environment, all resources in one root module
  multi-env/
    modules/app/               # one whole environment as a reusable module
    envs/shared/               # one per account: ECR repository + GitHub OIDC provider
    envs/stage/                # module "app" with stage values
    envs/prod/                 # module "app" with prod values
.github/workflows/
  deploy-prod-only.yml         # CD for prod-only (manual run)
  deploy.yml                   # CD for multi-env: build → stage → approval → prod
```

Only one layout may be up at a time: both create an ECR repository, an OIDC provider and DNS records with the
same names.

| Root | State key in the bucket |
|---|---|
| `prod-only` | `prod-only/terraform.tfstate` |
| `multi-env/envs/shared` | `shared/terraform.tfstate` |
| `multi-env/envs/stage` | `stage/terraform.tfstate` |
| `multi-env/envs/prod` | `prod/terraform.tfstate` |

Terraform reads **all `.tf` files of a folder** as one configuration; the split into files is only a convention:

| File | Content |
|---|---|
| `versions.tf` | `terraform {}` (version, providers, S3 backend) + `provider "aws"` |
| `variables.tf` | variable declarations (type, description, default) |
| `terraform.tfvars` | values for this environment (committed) |
| `private.auto.tfvars` | private values: alert email, GitHub token (gitignored, loaded automatically) |
| `data.tf` | lookups of existing things (zone, certificate, AZs) |
| `network.tf`, `security.tf`, `rds.tf`, `redis.tf`, `s3.tf`, … | resources by area |
| `outputs.tf` | values printed after apply and used by CI |

`.gitignore` must contain `.terraform/`, `*.tfstate`, `*.tfstate.*`, `private.auto.tfvars`.
`.terraform.lock.hcl` **is** committed: it pins provider versions.

## 4. prod-only: the stack step by step

The order below is the order it was built in; each step is one `plan` + `apply`.

### 4.1 Backend and provider (`versions.tf`)

```hcl
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    bucket       = "dimak-auth-tfstate-<account-id>"
    key          = "prod-only/terraform.tfstate"
    region       = "eu-west-1"
    profile      = "dev"
    use_lockfile = true   # lock file next to the state in S3, no DynamoDB table needed
    encrypt      = true
  }
}

provider "aws" {
  region              = var.region
  profile             = "dev"
  allowed_account_ids = ["<account-id>"]   # refuses to touch any other account
  default_tags {
    tags = { Project = "auth-providers", Env = "prod", ManagedBy = "terraform" }
  }
}
```

- Variables are **not allowed** in the `backend` block; the bucket name is a literal (or comes from
  `terraform init -backend-config=backend.hcl`).
- The state file appears in the bucket only after the first `apply` that creates something. `init` alone writes
  nothing.
- An account id is not a secret (AWS says so), so keeping it in code is acceptable.

### 4.2 Lookups (`data.tf`)

```hcl
data "aws_route53_zone" "main" {
  name         = "dimak-auth.xyz"
  private_zone = false
}

data "aws_acm_certificate" "main" {
  domain      = "dimak-auth.xyz"
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_availability_zones" "available" {
  state = "available"
}
```

Check with `terraform plan` + temporary outputs: `No changes`, outputs show the zone id and the certificate ARN.

### 4.3 VPC and subnets (`network.tf`)

```hcl
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  public_subnets = {
    "public-1" = { cidr = "10.0.1.0/24", az = local.azs[0] }
    "public-2" = { cidr = "10.0.2.0/24", az = local.azs[1] }
  }
  private_subnets = {
    "private-1" = { cidr = "10.0.10.0/24", az = local.azs[0] }
    "private-2" = { cidr = "10.0.11.0/24", az = local.azs[1] }
  }
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "public" {
  for_each          = local.public_subnets
  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  tags              = { Name = each.key }
}
# aws_subnet.private: the same over local.private_subnets
```

- `locals` are named constants inside the configuration (`local.<name>`); they create nothing in AWS.
- `for_each` over a map makes the **map keys the instance keys**: the subnets are
  `aws_subnet.public["public-1"]`, `aws_subnet.public["public-2"]`, whether or not `each.key` is used inside.
  Removing one key removes only that instance (with `count` and indexes, later instances would shift and be
  recreated).
- References: one subnet `aws_subnet.public["public-1"].id`; all ids `values(aws_subnet.public)[*].id` or
  `[for s in aws_subnet.public : s.id]`.
- `availability_zone` can't change in place: a wrong AZ means the subnet is **replaced** (destroy + create).

### 4.4 Internet gateway and public route table

```hcl
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public          # iterate over created subnets, same keys
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}
```

A route table only decides where **outgoing** packets of a subnet go. An association is just the link
subnet ↔ table; without it the subnet uses the main table (`local` only, no internet).

### 4.5 NAT gateway and private route table

```hcl
resource "aws_nat_gateway" "main" {
  vpc_id            = aws_vpc.main.id
  availability_mode = "regional"    # spans AZs by itself; no subnet, no EIP to manage (auto mode)
  depends_on        = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}
# + aws_route_table_association.private over aws_subnet.private
```

- `depends_on`: the NAT references only the VPC, so without it Terraform could create it before the internet
  gateway, which a public NAT needs.
- Traffic inside the VPC (`10.0.x.x`: ALB → task, task → RDS) matches the more specific `local` route and never goes
  through the NAT (longest prefix wins).

### 4.6 S3 gateway endpoint

```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
}
```

Free; ECR image layers come from S3, so image pulls bypass the NAT (which bills per GB).

### 4.7 Security groups (`security.tf`)

Groups `alb`, `api`, `rds`, rules as separate resources (`aws_vpc_security_group_ingress_rule` /
`_egress_rule`), not inline `ingress {}` blocks — each rule has its own address and changes without touching the
others:

| Rule | From |
|---|---|
| ALB 80, 443 | `0.0.0.0/0` |
| api 8000 | `referenced_security_group_id = aws_security_group.alb.id` |
| rds 5432 | `referenced_security_group_id = aws_security_group.api.id` |
| egress all, for each group | `0.0.0.0/0`, `ip_protocol = "-1"` |

**Important:** the console adds "allow all outbound" automatically; **Terraform removes it** from groups it creates.
Without explicit egress rules the tasks can't pull the image or reach RDS.

### 4.8 RDS (`rds.tf`)

```hcl
resource "aws_db_subnet_group" "main" {
  name       = "auth-private-db"
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_db_instance" "main" {
  identifier                  = "auth-provider-db"
  engine                      = "postgres"
  engine_version              = "18"       # major only: RDS applies minor upgrades, Terraform shows no diff
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "bench"
  username                    = "app"
  manage_master_user_password = true       # password generated by RDS, kept in Secrets Manager
  db_subnet_group_name        = aws_db_subnet_group.main.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  publicly_accessible         = false
  backup_retention_period     = 7
  deletion_protection         = true       # set false (apply) before destroy
  skip_final_snapshot         = true       # real prod: false + final_snapshot_identifier
}
```

- The subnet group needs subnets in **at least two AZs** (`DBSubnetGroupDoesNotCoverEnoughAZs` otherwise).
- Growing `allocated_storage` is an in-place change without data loss; shrinking is impossible; the next resize is
  possible after 6 hours. `max_allocated_storage` enables storage autoscaling.
- RDS PostgreSQL 15+ requires TLS by default (`rds.force_ssl = 1`); asyncpg negotiates it automatically.

### 4.9 ECR (`ecr.tf`)

```hcl
resource "aws_ecr_repository" "api" {
  name                 = "auth-providers-api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true   # destroy also deletes images; keep false for a real prod
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}
```

`jsonencode` turns an HCL object into JSON — no hand-written JSON strings.

### 4.10 App config in SSM (`ssm.tf`)

```hcl
locals {
  app_config = {
    PROVIDER      = "supabase"
    POSTGRES_HOST = aws_db_instance.main.address
    POSTGRES_PORT = tostring(aws_db_instance.main.port)
    POSTGRES_DB   = aws_db_instance.main.db_name
    AUTH_DOMAIN   = "${var.supabase_ref}.supabase.co"
    ISSUER        = "https://${var.supabase_ref}.supabase.co/auth/v1"
    ISSUER_PATH   = "/.well-known/jwks.json"
    API_AUDIENCE  = "authenticated"
    ALGORITHMS    = jsonencode(["ES256"])
    CORS_ORIGINS  = jsonencode(var.cors_origins)
  }
}

resource "aws_ssm_parameter" "app" {
  for_each = local.app_config
  name     = "/auth-providers/api/${each.key}"
  type     = "String"
  value    = each.value
}
```

- The DB host comes straight from the RDS resource; nothing is copied by hand.
- `jsonencode` produces valid JSON, which avoids the console pitfall of values stored with literal quotes
  (`'[...]'`).
- Only values that differ between environments are variables (`supabase_ref`, `cors_origins`); constants are
  written in place.

### 4.11 Log group and task execution role (`iam.tf`)

```hcl
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/auth-providers-api"
  retention_in_days = 30
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "auth-providers-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {     # managed policy, attached by ARN
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_extra" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_db_instance.main.master_user_secret[0].secret_arn]
  }
  statement {
    actions   = ["ssm:GetParameters"]
    resources = [for p in aws_ssm_parameter.app : p.arn]
  }
}

resource "aws_iam_role_policy" "task_execution_extra" {          # inline policy, lives inside the role
  name   = "read-app-config"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_extra.json
}
```

```
ecs-tasks.amazonaws.com ──AssumeRole──► task execution role
                                          ├─ AmazonECSTaskExecutionRolePolicy → pull from ECR, write logs
                                          └─ inline read-app-config           → RDS secret, 10 SSM parameters
```

- The trust policy says **who** may use the role; the attached policies say **what** it may do.
- The log group is created by Terraform with retention, so `logs:CreateLogGroup` is not needed.
- The execution role is used by ECS to **start** the task. Code inside the container that calls AWS (e.g. S3 via
  boto3) needs a separate **task role** (`task_role_arn`).
- `aws_iam_policy_document` is a data source that only renders JSON. When it references a resource with pending
  changes, the plan shows it as *will be read during apply* and the policy as `known after apply`; the resulting JSON
  is the same.

### 4.12 ECS cluster and task definition (`ecs.tf`)

```hcl
resource "aws_ecs_cluster" "main" {
  name = "auth-providers"
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
}

locals {
  db_secret_arn = aws_db_instance.main.master_user_secret[0].secret_arn
  container_secrets = concat(
    [for name, p in aws_ssm_parameter.app : { name = name, valueFrom = p.arn }],
    [
      { name = "POSTGRES_USER",     valueFrom = "${local.db_secret_arn}:username::" },
      { name = "POSTGRES_PASSWORD", valueFrom = "${local.db_secret_arn}:password::" },
    ]
  )
}

resource "aws_ecs_task_definition" "api" {
  family                   = "auth-providers-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512    # 0.5 vCPU
  memory                   = 1024   # 1 GB
  execution_role_arn       = aws_iam_role.task_execution.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
  container_definitions = jsonencode([{
    name         = "api"
    image        = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    secrets      = local.container_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}
```

- In `for name, p in <resource with for_each>` the first variable is the key, the second the instance.
- `<secret-arn>:username::` picks one JSON key of the RDS secret.
- `var.image_tag` matters only for the **first** task definition; later revisions are registered by CI.

### 4.13 Target group, ALB, listeners, DNS (`alb.tf`)

```hcl
resource "aws_lb_target_group" "api" {
  name                 = "auth-providers-api"
  target_type          = "ip"       # required for Fargate / awsvpc
  protocol             = "HTTP"
  port                 = 8000
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30         # default 300 s makes every deploy slow
  health_check {
    path    = "/healthz"
    matcher = "200"
  }
}

resource "aws_lb" "main" {
  name               = "auth-providers-alb"
  load_balancer_type = "application"
  subnets            = values(aws_subnet.public)[*].id
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09"
  certificate_arn   = data.aws_acm_certificate.main.arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener" "http" {      # 80 → 301 to 443
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.dimak-auth.xyz"
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id   # the ALB's service zone, not our hosted zone
    evaluate_target_health = true
  }
}
```

Right after this step `https://api…/healthz` answers **503**: the ALB works, the target group is empty.

**Health checks vs Kubernetes probes.** The ALB health check acts as readiness (no traffic to an unhealthy target)
and, because the ECS service replaces targets the ALB marks unhealthy, also as liveness. Point it at a shallow
endpoint (`/healthz`), not at one that checks the database (`/readyz`): if the DB goes down, every task fails the
check and ECS restarts them in a loop. Tuning: `unhealthy_threshold` × `interval` (time to recover),
`health_check_grace_period_seconds` on the service (start-up time). If all targets are unhealthy the ALB fails open
and sends traffic to all of them.

### 4.14 ECS service and auto scaling

```hcl
resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2

  capacity_provider_strategy {          # 1 task always on regular Fargate,
    capacity_provider = "FARGATE"       # the rest split 50/50 with Spot
    base              = 1
    weight            = 1
  }
  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }

  network_configuration {
    subnets          = values(aws_subnet.private)[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {                       # ECS registers task IPs in the target group itself
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"            # must equal the container name in the task definition
    container_port   = 8000
  }

  health_check_grace_period_seconds = 60   # Alembic migrations at start-up
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]   # CI deploys revisions, the scaler sets the count
  }

  depends_on = [aws_lb_listener.https, aws_ecs_cluster_capacity_providers.main]
}

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 2
  max_capacity       = 4
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "cpu-60"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  target_tracking_scaling_policy_configuration {
    target_value = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
```

- `depends_on` on the listener: the target group must be attached to a load balancer before the service registers
  into it.
- Changing `capacity_provider_strategy` on an existing service needs `force_new_deployment = true`.
- Fargate Spot gives no interruption guarantees; with Spot only, both tasks can be reclaimed at once and stay
  `PENDING` while Spot capacity is missing. Hence one task on regular Fargate.
- The CloudWatch alarms of the scaling policy (AlarmHigh/AlarmLow) are created automatically.
- Rolling update: with the defaults (min 100 % / max 200 %) new tasks start next to the old ones, the old ones stop
  after the new ones pass the ALB health check — 3–4 running tasks for a moment is normal.

### 4.15 Alerts (`alerts.tf`)

```hcl
resource "aws_sns_topic" "alerts" {
  name = "auth-providers-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email      # from private.auto.tfvars
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "api-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"   # 5xx from the app, not from the ALB itself
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

The email subscription must be confirmed through the link in the AWS email; until then it is
`PendingConfirmation` and nothing is delivered.

### 4.16 Frontend on Amplify (`amplify.tf`)

```hcl
resource "aws_amplify_app" "frontend" {
  name         = "Auth-providers"
  repository   = "https://github.com/<owner>/Auth-providers"
  access_token = var.github_token        # classic PAT, scope repo; private.auto.tfvars
  platform     = "WEB"

  build_spec = <<-YAML
    version: 1
    applications:
      - appRoot: frontend
        frontend:
          phases:
            preBuild:
              commands:
                - npm ci --cache .npm --prefer-offline
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: dist
            files:
              - '**/*'
          cache:
            paths:
              - .npm/**/*
  YAML

  # SPA: every path without a file extension is served by index.html
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "frontend"   # the console sets it via the "monorepo" checkbox
    VITE_API_URL              = "https://api.dimak-auth.xyz"
    VITE_DEFAULT_PROVIDER     = "supabase"
    VITE_SUPABASE_URL         = "https://${var.supabase_ref}.supabase.co"
    VITE_SUPABASE_KEY         = var.supabase_publishable_key
  }
}

resource "aws_amplify_branch" "main" {
  app_id            = aws_amplify_app.frontend.id
  branch_name       = "main"
  stage             = "PRODUCTION"
  enable_auto_build = true
}

resource "aws_amplify_domain_association" "main" {
  app_id                = aws_amplify_app.frontend.id
  domain_name           = "dimak-auth.xyz"
  wait_for_verification = false
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = "app"
  }
}
```

- `AMPLIFY_MONOREPO_APP_ROOT` must equal `appRoot`.
- The rewrite rule is added automatically by the console, **not** by the API: without it reloading `/orders`
  redirects to `/orders/` and the SPA breaks. In HCL strings the regex backslash is written `\\.`.
- Amplify creates its Route 53 records itself (`app` and a validation CNAME).
- The PAT ends up in the state (encrypted bucket); revoke it once the app exists.

### 4.17 GitHub OIDC and the deploy role (`github.tf`)

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]     # no thumbprint needed any more
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:<owner>@<owner-id>/Auth-providers@<repo-id>:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}
```

Permissions of `github-deploy` (inline policy):

| Statement | Actions | Resource |
|---|---|---|
| ECR login | `ecr:GetAuthorizationToken` | `*` (API limitation) |
| ECR push | `BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`, `BatchGetImage` | the repository |
| Task definition | `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition` | `*` (API limitation) |
| Service | `ecs:UpdateService`, `ecs:DescribeServices` | the service |
| Pass role | `iam:PassRole` with `iam:PassedToService = ecs-tasks.amazonaws.com` | the execution role |

**The `sub` claim.** This repository has GitHub's **immutable subject claims** enabled, so the token's `sub` contains
numeric ids: `repo:<owner>@<owner-id>/<repo>@<repo-id>:ref:refs/heads/main`. With the classic form
`repo:<owner>/<repo>:ref:refs/heads/main` the assume fails with
`Not authorized to perform sts:AssumeRoleWithWebIdentity`. Check what the repo uses:
```powershell
gh api repos/<owner>/Auth-providers/actions/oidc/customization/sub
# {"use_default":true,"use_immutable_subject":true,"sub_claim_prefix":"repo:<owner>@<owner-id>/Auth-providers@<repo-id>"}
```
The immutable form is safer: a renamed or re-created repository with the same name gets a different id.

### 4.18 Cache: Valkey Serverless (`redis.tf`, `security.tf`)

A production-style cache: private subnets, TLS always on (serverless can't disable it), password authentication
through a user group, a cost ceiling, daily snapshots.

`versions.tf` gets a second provider (run `terraform init -upgrade` after adding it; the lock file changes):
```hcl
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
```

Security group (in `security.tf`; add `redis = aws_security_group.redis.id` to the egress map from §4.7):
```hcl
resource "aws_security_group" "redis" {
  name        = "auth-providers-redis"
  description = "Valkey: 6379/6380 from the ECS tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_api" {
  for_each = toset(["6379", "6380"])       # primary endpoint, reader endpoint

  security_group_id            = aws_security_group.redis.id
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
}
```
`for_each = toset([...])` makes the strings themselves the instance keys (`redis_from_api["6379"]`).

`redis.tf`:
```hcl
resource "random_password" "redis" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}<>:?"   # ElastiCache rejects , " / @ and spaces
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "auth-providers/redis-password"
  recovery_window_in_days = 0   # otherwise the name stays blocked for 7–30 days after destroy
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = random_password.redis.result   # plain string, not JSON
}

resource "aws_elasticache_user" "app" {
  user_id       = "auth-providers-app"
  user_name     = "app"
  engine        = "valkey"
  access_string = "on ~* +@all"                  # enabled, all keys, all commands
  authentication_mode {
    type      = "password"
    passwords = [random_password.redis.result]
  }
}

resource "aws_elasticache_user_group" "main" {
  user_group_id = "auth-providers"
  engine        = "valkey"
  user_ids      = [aws_elasticache_user.app.user_id]
}

resource "aws_elasticache_serverless_cache" "main" {
  name                 = "auth-providers"
  engine               = "valkey"
  major_engine_version = "8"

  subnet_ids         = values(aws_subnet.private)[*].id
  security_group_ids = [aws_security_group.redis.id]
  user_group_id      = aws_elasticache_user_group.main.user_group_id

  cache_usage_limits {                              # the cost ceiling
    data_storage {
      maximum = 1
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = 5000
    }
  }

  snapshot_retention_limit = 1
  daily_snapshot_time      = "03:00"
}

output "redis_endpoint" {
  value = aws_elasticache_serverless_cache.main.endpoint[0].address
}
```

- **The `default` user.** For the Redis OSS engine a user group must contain a user named `default`, so people add a
  disabled one (`user_name = "default"`, `access_string = "off -@all"`, `no-password-required`). With the **Valkey**
  engine the group was accepted with only `app`, so nobody can connect without the password. Keep the disabled
  `default` user at hand in case a provider/API version rejects the group.
- **`endpoint` / `reader_endpoint`** are list blocks: `endpoint[0].address`, `endpoint[0].port`.
- **The password ends up in the state** (unavoidable with `random_password`); the state bucket is private and
  encrypted.

Wiring it into the task:
- `ssm.tf`, in `local.app_config`:
  ```hcl
      REDIS__HOST     = aws_elasticache_serverless_cache.main.endpoint[0].address
      REDIS__PORT     = tostring(aws_elasticache_serverless_cache.main.endpoint[0].port)
      REDIS__SSL      = "true"
      REDIS__CLUSTER  = "true"
      REDIS__USERNAME = aws_elasticache_user.app.user_name
  ```
  (`__` is pydantic-settings' `env_nested_delimiter`: `REDIS__HOST` → `settings.REDIS.HOST`.) The parameters and the
  execution role's `ssm:GetParameters` statement pick them up automatically through `for_each` / `for`.
- `ecs.tf`, in `local.container_secrets`: `{ name = "REDIS__PASSWORD", valueFrom = aws_secretsmanager_secret.redis.arn }`
  (whole secret, no `:key::` suffix because the value is a plain string).
- Execution role (`task_execution_extra` policy document): add `aws_secretsmanager_secret.redis.arn` to the
  `secretsmanager:GetSecretValue` resources.
- `aws_ecs_service.api`: add `aws_secretsmanager_secret_version.redis` to `depends_on`. The task definition references
  the secret, not its version, so without it the first tasks can start before the password is stored and fail with
  `ResourceInitializationError`. The cache itself needs no `depends_on`: its endpoint flows in through an SSM
  parameter, which already makes Terraform wait for it.

**Client side** (`src/infra/redis/client.py`): a serverless cache runs in cluster mode with TLS, so the app uses
`RedisCluster(host, port, username, password, ssl=True, ...)`. Credentials go as separate arguments, never inside a
URL (a generated password would need URL-encoding — the same trap as `%` in the DB password). Locally a plain Valkey
container is used with `REDIS__CLUSTER=false`, `REDIS__SSL=false` (§4.20).

### 4.19 Media: S3 bucket and the task role (`s3.tf`, `iam.tf`)

Order photos live in a private bucket. The browser uploads (presigned PUT) and loads (presigned GET) them directly;
the API only signs links and stores object **keys**. No VPC changes: the tasks reach S3 through the gateway endpoint
from §4.6.

`data.tf`: `data "aws_caller_identity" "current" {}` (account id for a globally unique bucket name).

`s3.tf`:
```hcl
resource "aws_s3_bucket" "media" {
  bucket        = "auth-providers-media-${data.aws_caller_identity.current.account_id}"
  force_destroy = true   # destroy also deletes objects; false for a real prod
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {   # browser PUT/GET via presigned URLs
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_origins = var.cors_origins
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {   # uploads never attached to an order
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "expire-unattached-uploads"
    status = "Enabled"
    filter {
      prefix = "tmp/"
    }
    expiration {
      days = 1
    }
  }
}
```
Bucket settings are separate resources since provider v4 (like SG rules): each changes without touching the bucket.
The lifecycle prefix is `tmp/` on purpose: the app currently keeps photos under `uploads/`; once uploads go to `tmp/`
and are copied to a permanent prefix on order creation, the rule starts cleaning up abandoned files.

Task role (`iam.tf`) — the role for **code inside the container** (boto3), as opposed to the execution role ECS uses
to start the task:
```hcl
resource "aws_iam_role" "task" {
  name               = "auth-providers-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json   # same trust: ecs-tasks.amazonaws.com
}

data "aws_iam_policy_document" "task_s3" {
  statement {
    sid       = "Objects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }
  statement {
    sid       = "List"      # without it head_object on a missing key returns 403 instead of 404
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn]
  }
}

resource "aws_iam_role_policy" "task_s3" {
  name   = "media_bucket"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_s3.json
}
```
- `aws_iam_role_policy_attachment` attaches an existing (managed) policy by ARN, reusable across roles;
  `aws_iam_role_policy` creates an inline policy that lives inside one role. Managed AWS policy → attachment;
  permissions specific to one role → inline.
- A presigned URL only works if the signer may perform the action, hence `PutObject` / `GetObject` on the role.
- `aws_ecs_task_definition.api`: `task_role_arn = aws_iam_role.task.arn`.
- `ssm.tf`: `S3__BUCKET = aws_s3_bucket.media.bucket`, `S3__REGION = var.region`. No endpoint URLs and no keys in AWS:
  boto3 uses the real S3 and the task role's short-lived credentials.
- GitHub deploy role (§4.17): add `aws_iam_role.task.arn` to the `iam:PassRole` resources — a task definition that
  references a task role can't be registered otherwise.

**Client side** (`src/infra/media/client.py`): two boto3 clients — *internal* (server → storage: `head_object`,
`delete_object`) and *public* (only signs URLs for the browser). In AWS both use the **regional** endpoint:
```python
regional = f"https://s3.{s.REGION}.amazonaws.com"
internal = boto3.client("s3", endpoint_url=s.ENDPOINT_URL or regional, **common)
public   = boto3.client("s3", endpoint_url=s.PUBLIC_ENDPOINT_URL or s.ENDPOINT_URL or regional, **common)
```
With the default global host (`<bucket>.s3.amazonaws.com`) a new bucket outside us-east-1 answers presigned requests
with `307 Temporary Redirect`, which browsers don't follow in CORS requests — it surfaces as a CORS error.
`generate_presigned_url` is pure signing (no network) and can be called in async code directly; `head_object` /
`delete_object` go through `asyncio.to_thread`.

Upload flow implemented on top of it: `POST /api/v1/orders/uploads {"content_type": …}` → `{upload_url, key}` →
browser PUTs the file to S3 → `POST /api/v1/orders` with the key → the service checks the key prefix
(`uploads/<user-id>/`) and `head_object`, stores the key → order responses carry a fresh presigned `photo_url`.

### 4.20 Local development parity (docker-compose)

The same code runs locally against containers instead of AWS services; only environment variables differ.

| Service | Container | Settings in `.env` |
|---|---|---|
| Cache | `valkey/valkey:8` (no TLS, no auth) | `REDIS__HOST=redis`, `REDIS__PORT=6379`, `REDIS__SSL=false`, `REDIS__CLUSTER=false` |
| S3 | `chrislusf/seaweedfs` with `server -s3` on port 8333, keys in `seaweedfs/s3.json` | `S3__ENDPOINT_URL=http://s3:8333`, `S3__PUBLIC_ENDPOINT_URL=http://localhost:8333`, `S3__ACCESS_KEY_ID`, `S3__SECRET_ACCESS_KEY` |
| Bucket + CORS | one-shot `amazon/aws-cli` container (`s3-init`): waits for the API, `s3 mb`, `put-bucket-cors` from `seaweedfs/cors.json` | `S3__BUCKET`, `S3__REGION` |

- Two S3 endpoints locally: inside the docker network the storage is `s3:8333`, but the browser can't resolve that
  name, so links for the browser are signed with `localhost:8333`. Locally path-style addressing is used
  (`addressing_style = "path"`), in AWS virtual-hosted.
- Why SeaweedFS: `minio/minio` images are no longer published on Docker Hub, and the current `localstack/localstack`
  image exits without a `LOCALSTACK_AUTH_TOKEN`.
- `api` waits for Valkey (`healthcheck: valkey-cli ping`) and for `s3-init` to finish.

## 5. First image, first apply, first frontend build

ECS can't start without an image, so the repository and the first image come before the service. Practical order:

1. Create only the repository first, so there is somewhere to push:
   ```powershell
   terraform apply -target="aws_ecr_repository.api" -target="aws_ecr_lifecycle_policy.api"
   ```
2. Push the first image (from the root folder of the configuration; the build context is the repository root):
   ```powershell
   $REPO = terraform output -raw ecr_repository_url
   $REGISTRY = $REPO.Split("/")[0]
   $TAG = git rev-parse --short HEAD
   aws ecr get-login-password --region eu-west-1 --profile dev | docker login --username AWS --password-stdin $REGISTRY
   docker build --platform linux/amd64 --provenance=false --sbom=false -t "${REPO}:$TAG" <path-to-repo-root>
   docker push "${REPO}:$TAG"
   ```
   `--provenance=false --sbom=false`: otherwise buildx pushes an OCI index plus attestations, and basic ECR
   scanning ignores the image.
3. Put `$TAG` into `image_tag` in `terraform.tfvars`, then the full `terraform apply` (~15 minutes; RDS, the Valkey
   cache and the NAT take longest). Commit the app code before building, so the tag (git SHA) matches the code.
4. Check:
   ```powershell
   curl.exe https://api.dimak-auth.xyz/healthz      # 200
   curl.exe https://api.dimak-auth.xyz/readyz       # 200: DB and cache reachable, migrations ran
   ```
5. Frontend: creating an Amplify app and branch through the API does **not** start a build (the console wizard
   does that itself; afterwards builds are triggered by the GitHub webhook on push). The custom domain stays
   `PENDING_DEPLOYMENT` until the branch has been deployed once:
   ```powershell
   aws amplify start-job --app-id <app-id> --branch-name main --job-type RELEASE --profile dev --region eu-west-1
   ```
6. Supabase → Authentication → URL Configuration: Site URL and Redirect URLs must contain the frontend URL.
7. Upload a photo with a new order on `app.dimak-auth.xyz`: the object appears under `uploads/<user-id>/` in the
   media bucket and the thumbnail loads in the list.

## 6. CD with GitHub Actions and OIDC

`.github/workflows/deploy-prod-only.yml` (manual run in the current repository; the original version ran on every
push to `main` with `paths-ignore` for `frontend/**`, `docs/**`, `infra/**`, `**.md`):

1. `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.AWS_ROLE_ARN }}` — temporary keys via
   OIDC, no access keys stored in GitHub. Requires `permissions: id-token: write`.
2. `aws-actions/amazon-ecr-login@v2`.
3. Build and push `:<short sha>` (skipped if the tag already exists — tags are immutable, a re-run would fail).
4. `aws ecs describe-task-definition` → `amazon-ecs-render-task-definition@v1` (swap only the image) →
   `amazon-ecs-deploy-task-definition@v2` with `wait-for-service-stability: true`.
5. `concurrency` prevents two deploys at the same time.

`AWS_ROLE_ARN` is a **repository variable** (Settings → Secrets and variables → Actions → Variables), not a secret:
a role ARN grants nothing by itself. It must not be an environment variable here: a job with `environment:` gets
a different `sub` (`…:environment:<name>`) that the prod-only trust policy doesn't accept.

The new task definition revision is a copy of the current one with a new image, so secrets, logging and roles stay
exactly as Terraform defined them. Terraform ignores those revisions thanks to
`ignore_changes = [task_definition]`.

## 7. multi-env: stage + prod

### 7.1 The idea

One module describes a whole environment; each environment is a small root that calls it with its own values and
has its own state. The same code goes first to stage, then to prod.

```hcl
# infra/multi-env/envs/stage/main.tf
module "app" {
  source = "../../modules/app"    # relative path; terraform init links it into .terraform/modules

  env           = "stage"
  api_subdomain = "api-stage"
  app_subdomain = "app-stage"
  vpc_cidr      = "10.1.0.0/16"
  image_tag     = var.image_tag
  min_tasks     = 1
  max_tasks     = 2
  on_demand_base   = 0            # everything on Spot
  on_demand_weight = 0
  ...
  github_oidc_sub    = "repo:<owner>@<owner-id>/Auth-providers@<repo-id>:environment:staging"
  amplify_auto_build = true
}
```

Which environment a command touches is decided by **the folder you run Terraform in** (its state key and values),
not by who is logged in to the AWS CLI — both environments live in the same account. Local modules don't need a new
`init` after their code changes; only after adding a module or changing its `source`.

### 7.2 What differs between stage and prod

| Setting | stage | prod |
|---|---|---|
| Domains | `api-stage` / `app-stage.dimak-auth.xyz` | `api` / `app.dimak-auth.xyz` |
| VPC | `10.1.0.0/16` | `10.0.0.0/16` |
| Tasks | 1–2, all on Fargate Spot | 2–4, one always on regular Fargate |
| Frontend | Amplify builds on every push to `main` | built only by CD after approval (`amplify_auto_build = false`) |
| Deploy role trusts | GitHub Environment `staging` | GitHub Environment `production` |
| Valkey cache / user / group | `auth-providers-stage` / `auth-providers-stage-app` | `auth-providers-prod` / `auth-providers-prod-app` |
| Redis password secret | `auth-providers/stage/redis-password` | `auth-providers/prod/redis-password` |
| Media bucket (CORS origin) | `auth-providers-stage-media-<account-id>` (`app-stage…`) | `auth-providers-prod-media-<account-id>` (`app…`) |
| Task role | `auth-providers-stage-task` | `auth-providers-prod-task` |
| State key | `stage/terraform.tfstate` | `prod/terraform.tfstate` |

Shared by both (`envs/shared`, applied first, destroyed last): the ECR repository (one image is promoted from stage
to prod) and the GitHub OIDC provider (one per account). The module finds them with `data` sources:

```hcl
data "aws_ecr_repository" "api" { name = "auth-providers-api" }
data "aws_iam_openid_connect_provider" "github" { url = "https://token.actions.githubusercontent.com" }
```

Also shared, outside Terraform: the hosted zone and the wildcard certificate. `api-stage` (not `api.stage`) because
`*.dimak-auth.xyz` covers one level only.

### 7.3 What changed in the module compared to prod-only

- `locals.tf`: `name = "auth-providers-${var.env}"`, `api_domain`, `app_domain`. Every resource name carries the
  environment (`auth-providers-stage-alb`, `/ecs/auth-providers-prod-api`, …) so the two environments don't
  collide in one account.
- Subnets are computed from the VPC CIDR:
  ```hcl
  cidrsubnet("10.1.0.0/16", 8, 1)    # /16 + 8 bits = /24, network number 1  → 10.1.1.0/24
  cidrsubnet("10.1.0.0/16", 8, 10)   #                     network number 10 → 10.1.10.0/24
  ```
- SSM path `/auth-providers/<env>/api/*`; `CORS_ORIGINS` is built from the frontend domain.
- Fargate/Spot split, task counts and deletion protection are variables.
- Valkey and S3 (§4.18, §4.19) live in the module (`redis.tf`, `s3.tf`): one cache, one password secret, one
  media bucket and one task role per environment. The cache limits are variables (`redis_max_storage_gb`,
  `redis_max_ecpu_per_second`, defaults 1 GB / 5 000). The bucket CORS origin is the environment's own frontend
  domain. The module declares `hashicorp/random` in its `versions.tf`; the env roots declare it too, so their lock
  files pin it.
- Amplify: one app per environment. The domain association registers the **full subdomain**
  (`domain_name = "app-stage.dimak-auth.xyz"`, `prefix = ""`) instead of the apex with a prefix, so two apps never
  claim the same domain.
- The deploy role trusts `…:environment:<name>` and may additionally run `ecr:DescribeImages` and
  `amplify:StartJob` / `amplify:GetJob` on its own Amplify branch; `iam:PassRole` covers both the execution role
  and the task role of its environment.
- Outputs: `api_url`, `app_url`, `ecs_cluster`, `ecs_service`, `task_family`, `amplify_app_id`,
  `github_deploy_role_arn`, `redis_endpoint`, `media_bucket`.

### 7.4 Alternatives (not used here)

- **Cheaper stage:** share the VPC, NAT, ALB (host-based listener rule) and cluster; stage gets only its own
  service, task definition, target group, RDS, SSM parameters and DNS records (~15–20 resources instead of ~40).
- **Real-world standard:** a separate AWS account per environment (AWS Organizations, free) with the same module,
  `allowed_account_ids` per environment and a deploy role per account. Isolates IAM, quotas and blast radius; lets
  infrastructure changes be tested on stage.
- **One account, stricter IAM:** deploy roles limited by name prefix (`service/*/stage-*`) or by tag
  (`aws:ResourceTag/Env = stage`). Leaky: many `Describe*`/`List*` calls can't be scoped, quotas are shared.

## 8. CD for stage → prod with approval

`.github/workflows/deploy.yml`, on push to `main` (ignoring `docs/**`, `infra/**`, `**.md`):

```
build (environment: staging)        build and push :<sha> once to the shared ECR
  └─ deploy-stage (staging)         new task definition revision → service auth-providers-stage/api
       └─ deploy-prod (production)  ⏸ waits for a reviewer
                                    same image → auth-providers-prod/api, then amplify start-job (prod frontend)
```

GitHub setup (repository → Settings → Environments; environments exist per repository only):

| Environment | Variables | Protection |
|---|---|---|
| `staging` | `AWS_ROLE_ARN` = `terraform output github_deploy_role_arn` (stage) | — |
| `production` | `AWS_ROLE_ARN` (prod), `AMPLIFY_APP_ID` = `terraform output amplify_app_id` (prod) | **Required reviewers** |

```powershell
gh variable set AWS_ROLE_ARN   --env staging    --body "<stage role arn>"
gh variable set AWS_ROLE_ARN   --env production --body "<prod role arn>"
gh variable set AMPLIFY_APP_ID --env production --body "<prod app id>"
```

- The approval is **not** in the YAML: `environment: production` only names the environment; the pause comes from
  its protection rule. Without the rule, prod deploys right after stage.
- Create the environments after `terraform apply` (the role ARNs and app id come from outputs).
- One artifact is promoted: the image built once is what stage tested and what prod runs. Branch-per-environment
  setups (`stage` → `prod` branches) drift apart and are avoided.
- Which AWS account a job deploys to is decided by the role it assumes (the account id is part of the role ARN);
  `allowed_account_ids` in Terraform guards against applying an environment with the wrong credentials.
- Re-running a cancelled run is safe: the build step skips an existing tag; ECS deployments started before the
  cancel complete on their own.

## 9. Running and tearing down

### 9.1 Bring up multi-env

```powershell
cd infra/multi-env/envs/shared; terraform init; terraform apply
# push the first image (§5), set image_tag in stage/prod terraform.tfvars
cd ../stage; terraform init; terraform apply     # stage and prod may run in parallel:
cd ../prod;  terraform init; terraform apply     # separate states and locks, shared resources are read-only
```

Then: GitHub environments (§8), Supabase Redirect URLs (+ `https://app-stage.dimak-auth.xyz`), first stage frontend
build (`amplify start-job` or the next push), first prod frontend build (the workflow after approval).

### 9.2 Checks

```powershell
curl.exe https://api-stage.dimak-auth.xyz/healthz            # 200
curl.exe https://api.dimak-auth.xyz/readyz                   # 200, body [] (DB and cache ok)
curl.exe https://api.dimak-auth.xyz/api/v1/users/me          # 401 without a token
curl.exe -I https://app.dimak-auth.xyz/orders                # 200, no redirect to /orders/
terraform plan -detailed-exitcode                            # exit code 0 = no drift
```

### 9.3 Tear down

1. `db_deletion_protection` / `deletion_protection` must be `false` (apply first if it was `true`).
2. multi-env: `prod` and `stage` (in parallel is fine) → then `shared`. prod-only: one `terraform destroy`.
3. Disable the workflow of the layout that is gone (`gh workflow disable deploy.yml`), otherwise every push fails at
   the AWS login step.
4. Check Route 53: only NS, SOA and the ACM validation CNAME should remain. Remove leftover Amplify records by hand.

Switching layouts: destroy one completely before applying the other; then point the repository variable
`AWS_ROLE_ARN` (prod-only) or the environment variables (multi-env) at the new roles.

## 10. Pitfalls and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `init`: `No valid credential sources found … EC2 IMDS` | Terraform < 1.15 doesn't read `aws login` profiles | Terraform ≥ 1.15 or a `credential_process` profile |
| State file not in the bucket after `init` | it is written on the first `apply` that creates something | nothing to fix |
| `DBSubnetGroupDoesNotCoverEnoughAZs` | both subnets in one AZ (copy-paste `azs[0]`) | second subnet `azs[1]`; the subnet is replaced, its route table stays |
| Tasks can't pull the image / reach RDS | Terraform removed the default egress rule | explicit `aws_vpc_security_group_egress_rule` |
| Plan shows an IAM policy `known after apply` | a policy document depends on a resource with pending changes | expected; the JSON stays the same |
| `CannotPullContainerError` | no image with `image_tag` in ECR | push the image first |
| `exec: "./entrypoint.sh": permission denied` in CI-built images | git stores the file as `100644`; Docker Desktop on Windows hid it by making files executable | `git update-index --chmod=+x entrypoint.sh` |
| Amplify shows "Migrate to our GitHub app", `repositoryCloneMethod = SSH` | the Amplify GitHub App had no access to the repo when the app was created, Amplify fell back to deploy key + webhook | install the app for the repo; **Start migration** or `terraform apply -replace=aws_amplify_app.frontend` |
| Custom domain `PENDING_DEPLOYMENT`, branch "No deploys" | API-created apps don't start a first build | `aws amplify start-job … --job-type RELEASE` |
| Reloading `/orders` redirects to `/orders/` and breaks | no SPA rewrite rule (only the console adds it) | `custom_rule` → `/index.html`, status `200` |
| `Invalid escape sequence` in the rewrite regex | `\.` inside an HCL string | write `\\.` |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `sub` mismatch: immutable subject claims, or a job with `environment:` vs a `ref:` condition | match the exact `sub` (`gh api …/oidc/customization/sub`) |
| `Error acquiring the state lock` | an interrupted run left the lock file | `terraform force-unlock <ID>` (make sure nothing else is running) |
| `already exists` after an interrupted apply | resources were created but not recorded in the state | `terraform import <address> <id>` for each orphan (or delete it), then `plan` |
| After importing RDS: `engine_version "18.3" -> "18"` | imported state holds the full version | apply, or recreate the empty DB with `-replace` |
| Two Amplify apps, one domain | an apex domain can be associated with one app only | associate the full subdomain per app |
| `deploy-prod` ran without a pause | `production` has no Required reviewers rule | add the rule in the environment settings |
| `Missing required provider … hashicorp/random` | new provider added, not installed | `terraform init -upgrade` (re-run `aws login` first if the session expired) |
| First tasks fail with `ResourceInitializationError` on `REDIS__PASSWORD` | service started before the secret value was written | `depends_on = [aws_secretsmanager_secret_version.redis]` on the service |
| `apply` after `destroy`: secret name already scheduled for deletion | Secrets Manager recovery window | `recovery_window_in_days = 0` |
| App can't reach the cache: timeouts, `MOVED` / `CROSSSLOT` | plain client or no TLS against a serverless cache | `RedisCluster`, `ssl=True` |
| Browser upload: CORS error, network tab shows `307 Temporary Redirect` | URL signed for the global S3 host | sign with `https://s3.<region>.amazonaws.com` |
| `head_object` → 403 for a key that isn't there | task role without `s3:ListBucket` | add `ListBucket` on the bucket ARN |
| Presigned PUT → 403 `SignatureDoesNotMatch` | browser sent a different `Content-Type` than signed | send exactly the signed type |
| CI: `RegisterTaskDefinition` access denied after adding a task role | deploy role lacks `iam:PassRole` on the task role | add the task role to the PassRole statement |
| Locally `pull access denied for minio/minio` / LocalStack exits asking for a license | images no longer published / token now required | SeaweedFS (§4.20) |
| Cached order list loses photos | cache `decode` didn't restore `photo_key` | rebuild every domain field in `decode` |

How the orphans after an interrupted `apply` were found: compare everything tagged with the environment
(`default_tags`) with the ids in the state.
```powershell
aws resourcegroupstaggingapi get-resources --tag-filters Key=Env,Values=stage --query "ResourceTagMappingList[].ResourceARN"
terraform state pull    # ids of everything Terraform knows
```

## 11. Costs

eu-west-1, on demand, everything running 24/7, approximate:

| | prod-only | multi-env (stage + prod) |
|---|---|---|
| NAT gateway(s) + public IPv4 | ~50–85 | ~100–170 |
| ALB(s) | ~20 | ~40 |
| Fargate (prod 1 regular + 1 Spot, stage 1 Spot) | ~25 | ~30 |
| RDS `db.t4g.micro` + 20 GB gp3 | ~16 | ~32 |
| Valkey Serverless (minimum + ECPU) and the media bucket | ~6–10 | ~12–20 |
| Route 53, Secrets Manager, ECR, logs, alarms, Amplify | ~3–5 | ~5–8 |
| **Total, $/month** | **~115–160** | **~225–300** |

Roughly $0.3–0.4 per hour for both environments together. The network (NAT, ALB, IPv4) costs more than the compute.
Check the account's plan and credits with `aws freetier get-account-plan-state --region us-east-1` and set an AWS
Budget with an email alert.

## 12. Concepts cheat sheet

| Term | Meaning here |
|---|---|
| `resource "type" "name"` | address `type.name`; with `for_each`: `type.name["key"]`; attribute `type.name["key"].id` |
| `data "type" "name"` | read-only lookup, address `data.type.name` |
| `variable` / `tfvars` | declaration (code) / values (per environment); `*.auto.tfvars` load automatically |
| `locals` | named values inside a configuration |
| `module` | a folder of `.tf` files called with inputs; outputs are read as `module.<name>.<output>` |
| `depends_on` | explicit order when there is no reference between resources |
| `lifecycle.ignore_changes` | attributes changed outside Terraform (CI, auto scaler) that Terraform must not revert |
| `-replace=<address>` | force recreation of one resource |
| `import` | adopt an existing resource into the state |
| `force-unlock` | remove a stale state lock |
| execution role vs task role | ECS starting the task (image, logs, secrets) vs the app's own AWS calls (S3, …) |
| managed vs inline policy | attached by ARN, reusable vs embedded in one role, deleted with it |
| OIDC `sub` | who the GitHub token belongs to: repo + branch (`ref:`) or environment (`environment:`) |
