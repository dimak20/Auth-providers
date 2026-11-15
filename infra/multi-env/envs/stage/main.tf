module "app" {
  source = "../../modules/app"

  env           = "stage"
  api_subdomain = "api-stage"
  app_subdomain = "app-stage"
  vpc_cidr      = "10.1.0.0/16"

  image_tag = var.image_tag
  min_tasks = 1
  max_tasks = 2

  # stage: everything on Spot
  on_demand_base   = 0
  on_demand_weight = 0

  db_deletion_protection = false

  supabase_ref             = var.supabase_ref
  supabase_publishable_key = var.supabase_publishable_key
  alert_email              = var.alert_email
  github_token             = var.github_token

  github_oidc_sub = "repo:dimak20@87275887/Auth-providers@1457050471:environment:staging"

  # stage frontend builds on every push to main
  amplify_auto_build = true
}
