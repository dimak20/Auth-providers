variable "image_tag" {
  type        = string
  description = "Image tag (git SHA) for the first task definition; CI deploys later ones"
}

variable "supabase_ref" {
  type = string
}

variable "supabase_publishable_key" {
  type = string
}

# private.auto.tfvars (gitignored)
variable "alert_email" {
  type = string
}

variable "github_token" {
  type      = string
  sensitive = true
}
