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

  name  = "/auth-providers/api/${each.key}"
  type  = "String"
  value = each.value
}
