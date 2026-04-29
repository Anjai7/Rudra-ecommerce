output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/ecommerce"
  sensitive = true
}

output "redis_url" {
  value     = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  sensitive = true
}

output "s3_bucket_name" {
  value = aws_s3_bucket.assets.id
}

output "s3_bucket_arn" {
  value = aws_s3_bucket.assets.arn
}
