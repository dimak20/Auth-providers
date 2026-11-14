output "zone_id" {
  value = data.aws_route53_zone.main.zone_id
}

output "certificate_arn" {
  value = data.aws_acm_certificate.main.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
