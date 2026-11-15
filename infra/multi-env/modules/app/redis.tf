# Valkey Serverless: private subnets, TLS always on, password auth through a user group, a cost ceiling.

resource "random_password" "redis" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}<>:?" # ElastiCache rejects , " / @ and spaces
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "auth-providers/${var.env}/redis-password"
  recovery_window_in_days = 0 # otherwise the name stays blocked for 7–30 days after destroy
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = random_password.redis.result # plain string, not JSON
}

resource "aws_elasticache_user" "app" {
  user_id       = "${local.name}-app"
  user_name     = "app"
  engine        = "valkey"
  access_string = "on ~* +@all"

  authentication_mode {
    type      = "password"
    passwords = [random_password.redis.result]
  }
}

resource "aws_elasticache_user_group" "main" {
  user_group_id = local.name
  engine        = "valkey"
  user_ids      = [aws_elasticache_user.app.user_id]
}

resource "aws_elasticache_serverless_cache" "main" {
  name                 = local.name
  engine               = "valkey"
  major_engine_version = "8"

  subnet_ids         = values(aws_subnet.private)[*].id
  security_group_ids = [aws_security_group.redis.id]
  user_group_id      = aws_elasticache_user_group.main.user_group_id

  cache_usage_limits {
    data_storage {
      maximum = var.redis_max_storage_gb
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = var.redis_max_ecpu_per_second
    }
  }

  snapshot_retention_limit = 1
  daily_snapshot_time      = "03:00"
}
