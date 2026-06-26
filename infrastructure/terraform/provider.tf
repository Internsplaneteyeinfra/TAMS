# Terraform Provider Configuration
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Uncomment for remote state management
  # backend "s3" {
  #   bucket         = "tams-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "tams-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "TAMS"
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}
