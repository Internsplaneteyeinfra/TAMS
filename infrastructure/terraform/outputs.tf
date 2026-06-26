# Terraform Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "backend_alb_dns" {
  description = "Backend ALB DNS name"
  value       = aws_lb.backend.dns_name
}

output "frontend_alb_dns" {
  description = "Frontend ALB DNS name"
  value       = aws_lb.frontend.dns_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for imagery"
  value       = aws_s3_bucket.imagery.id
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  sensitive   = true
}

output "ecr_repository_backend" {
  description = "ECR repository for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_frontend" {
  description = "ECR repository for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}
