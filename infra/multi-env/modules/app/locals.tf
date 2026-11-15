locals {
  name       = "auth-providers-${var.env}"
  api_domain = "${var.api_subdomain}.${var.domain}"
  app_domain = "${var.app_subdomain}.${var.domain}"
}
