data "aws_route53_zone" "main" {
  name         = var.domain
  private_zone = false
}

data "aws_acm_certificate" "main" {
  domain      = var.domain
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# shared resources, created in envs/shared
data "aws_ecr_repository" "api" {
  name = "auth-providers-api"
}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}
