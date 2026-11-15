resource "aws_amplify_app" "frontend" {
  name         = "Auth-providers"
  repository   = "https://github.com/dimak20/Auth-providers"
  access_token = var.github_token
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

  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "frontend"
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
