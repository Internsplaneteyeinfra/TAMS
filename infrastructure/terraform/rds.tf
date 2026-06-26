# RDS PostgreSQL Database with PostGIS
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier            = "${var.app_name}-postgres"
  engine                = "postgres"
  engine_version        = var.db_engine_version
  instance_class        = "db.t3.micro"
  allocated_storage     = var.db_allocated_storage
  storage_type          = "gp3"
  
  db_name  = "tams_db"
  username = "tams_admin"
  password = random_password.db_password.result
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  publicly_accessible       = false
  multi_az                  = var.enable_multi_az
  deletion_protection       = var.enable_deletion_protection
  skip_final_snapshot       = var.environment == "dev"
  final_snapshot_identifier = "${var.app_name}-final-snapshot"
  
  backup_retention_period = var.environment == "prod" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  
  enable_cloudwatch_logs_exports = ["postgresql"]
  
  tags = {
    Name = "${var.app_name}-postgres"
  }
}

# Generate random password for DB
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store DB password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.app_name}/rds/password"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-db-password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.app_name}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  
  subnet_group_name       = aws_elasticache_subnet_group.main.name
  security_group_ids      = [aws_security_group.redis.id]
  maintenance_window      = "mon:03:00-mon:04:00"
  notification_topic_arn  = var.environment == "prod" ? aws_sns_topic.alerts.arn : null
  
  tags = {
    Name = "${var.app_name}-redis"
  }
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.app_name}-alerts"

  tags = {
    Name = "${var.app_name}-alerts"
  }
}

# S3 Bucket for Imagery
resource "aws_s3_bucket" "imagery" {
  bucket = "${var.app_name}-imagery-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.app_name}-imagery"
  }
}

resource "aws_s3_bucket_versioning" "imagery" {
  bucket = aws_s3_bucket.imagery.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "imagery" {
  bucket = aws_s3_bucket.imagery.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "imagery" {
  bucket = aws_s3_bucket.imagery.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ECR Repositories
resource "aws_ecr_repository" "backend" {
  name                 = "${var.app_name}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.app_name}-backend-repo"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.app_name}/frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.app_name}-frontend-repo"
  }
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  lifecycle_policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus     = "tagged"
        tagPrefixList = ["v"]
        countType     = "imageCountMoreThan"
        countNumber   = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}
