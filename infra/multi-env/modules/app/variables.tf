variable "env" {
  type        = string
  description = "Environment name: stage | prod"
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "domain" {
  type    = string
  default = "dimak-auth.xyz"
}

variable "api_subdomain" {
  type        = string
  description = "api | api-stage"
}

variable "app_subdomain" {
  type        = string
  description = "app | app-stage"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "image_tag" {
  type        = string
  description = "Image tag (git SHA) for the first task definition; CI deploys later ones"
}

variable "min_tasks" {
  type    = number
  default = 2
}

variable "max_tasks" {
  type    = number
  default = 4
}

variable "on_demand_base" {
  type        = number
  default     = 1
  description = "Tasks always on regular FARGATE; the rest are split by weight"
}

variable "on_demand_weight" {
  type        = number
  default     = 1
  description = "FARGATE weight next to FARGATE_SPOT weight 1 (0 = everything above base on Spot)"
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "supabase_ref" {
  type        = string
  description = "Supabase project ref (<ref>.supabase.co)"
}

variable "supabase_publishable_key" {
  type = string
}

variable "alert_email" {
  type = string
}

variable "github_token" {
  type      = string
  sensitive = true
}

variable "github_repository" {
  type    = string
  default = "https://github.com/dimak20/Auth-providers"
}

variable "github_oidc_sub" {
  type        = string
  description = "Allowed OIDC sub, e.g. repo:<owner>@<id>/<repo>@<id>:environment:production"
}

variable "amplify_branch" {
  type    = string
  default = "main"
}

variable "amplify_auto_build" {
  type        = bool
  default     = true
  description = "false = builds only when CD calls amplify start-job"
}
