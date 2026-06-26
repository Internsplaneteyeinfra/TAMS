# Terraform Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "tams"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "container_port" {
  description = "Container port for backend"
  type        = number
  default     = 8000
}

variable "container_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_engine_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.3"
}

variable "enable_multi_az" {
  description = "Enable RDS Multi-AZ"
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Enable RDS deletion protection"
  type        = bool
  default     = false
}
