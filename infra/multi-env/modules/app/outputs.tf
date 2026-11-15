output "api_url" {
  value = "https://${local.api_domain}"
}

output "app_url" {
  value = "https://${local.app_domain}"
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.api.name
}

output "task_family" {
  value = aws_ecs_task_definition.api.family
}

output "amplify_app_id" {
  value = aws_amplify_app.frontend.id
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
