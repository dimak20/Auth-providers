variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "supabase_ref" {
  type        = string
  description = "Supabase project ref (<ref>.supabase.co)"
}

variable "cors_origins" {
  type    = list(string)
  default = ["https://app.dimak-auth.xyz"]
}

variable "image_tag" {
  type        = string
  description = "Image tag (git SHA) for the first task definition; CI deploys later ones"
}

variable "alert_email" {
  type = string
}

variable "github_token" {
  type      = string
  sensitive = true
}

variable "supabase_publishable_key" {
  type = string
}
