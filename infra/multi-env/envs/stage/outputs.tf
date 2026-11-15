output "api_url" {
  value = module.app.api_url
}

output "app_url" {
  value = module.app.app_url
}

output "ecs_cluster" {
  value = module.app.ecs_cluster
}

output "ecs_service" {
  value = module.app.ecs_service
}

output "task_family" {
  value = module.app.task_family
}

output "amplify_app_id" {
  value = module.app.amplify_app_id
}

output "github_deploy_role_arn" {
  value = module.app.github_deploy_role_arn
}

output "redis_endpoint" {
  value = module.app.redis_endpoint
}

output "media_bucket" {
  value = module.app.media_bucket
}
