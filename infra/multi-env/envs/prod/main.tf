module "app" {
  source = "../../modules/app"

  env           = "prod"
  api_subdomain = "api"
  app_subdomain = "app"
  vpc_cidr      = "10.0.0.0/16"

  image_tag = var.image_tag
  min_tasks = 2
  max_tasks = 4

  # 1 task always on regular Fargate, the rest split 50/50 with Spot
  on_demand_base   = 1
  on_demand_weight = 1

  db_deletion_protection = false # true for a real prod; must be false before destroy

  supabase_ref             = var.supabase_ref
  supabase_publishable_key = var.supabase_publishable_key
  alert_email              = var.alert_email
  github_token             = var.github_token

  github_oidc_sub = "repo:dimak20@87275887/Auth-providers@1457050471:environment:production"

  # prod frontend is released by CD (amplify start-job) after approval, not on every push
  amplify_auto_build = false
}
