terraform {
  required_version = ">= 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket       = "dimak-auth-tfstate-982081081998"
    key          = "stage/terraform.tfstate"
    region       = "eu-west-1"
    profile      = "dev"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region              = "eu-west-1"
  profile             = "dev"
  allowed_account_ids = ["982081081998"]

  default_tags {
    tags = {
      Project   = "auth-providers"
      Env       = "stage"
      ManagedBy = "terraform"
    }
  }
}
