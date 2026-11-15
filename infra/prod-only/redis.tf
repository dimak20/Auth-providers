resource "random_password" "redis" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "auth-providers/redis-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = random_password.redis.result
}

# the app user
resource "aws_elasticache_user" "app" {
  user_id       = "auth-providers-app"
  user_name     = "app"
  engine        = "valkey"
  access_string = "on ~* +@all"

  authentication_mode {
    type      = "password"
    passwords = [random_password.redis.result]
  }
}

# replaces the built-in "default" user with a disabled one
# resource "aws_elasticache_user" "default_off" {
#   user_id       = "auth-providers-default-off"
#   user_name     = "default"
#   engine        = "valkey"
#   access_string = "off -@all"

#   authentication_mode {
#     type = "no-password-required"
#   }
# }

resource "aws_elasticache_user_group" "main" {
  user_group_id = "auth-providers"
  engine        = "valkey"
  #   user_ids      = [aws_elasticache_user.app.user_id, aws_elasticache_user.default_off.user_id]
  user_ids = [aws_elasticache_user.app.user_id]
}

resource "aws_elasticache_serverless_cache" "main" {
  name                 = "auth-providers"
  engine               = "valkey"
  major_engine_version = "8"

  subnet_ids         = values(aws_subnet.private)[*].id
  security_group_ids = [aws_security_group.redis.id]
  user_group_id      = aws_elasticache_user_group.main.user_group_id

  cache_usage_limits {
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
