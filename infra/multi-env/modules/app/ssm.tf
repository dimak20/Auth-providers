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
    CORS_ORIGINS  = jsonencode(["https://${local.app_domain}"])

    REDIS__HOST     = aws_elasticache_serverless_cache.main.endpoint[0].address
    REDIS__PORT     = tostring(aws_elasticache_serverless_cache.main.endpoint[0].port)
    REDIS__SSL      = "true"
    REDIS__CLUSTER  = "true"
    REDIS__USERNAME = aws_elasticache_user.app.user_name

    S3__BUCKET = aws_s3_bucket.media.bucket
    S3__REGION = var.region
  }
}

resource "aws_ssm_parameter" "app" {
  for_each = local.app_config

  name  = "/auth-providers/${var.env}/api/${each.key}"
  type  = "String"
  value = each.value
}
