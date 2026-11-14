resource "aws_db_subnet_group" "main" {
  name       = "auth-private-db"
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_db_instance" "main" {
  identifier     = "auth-provider-db"
  engine         = "postgres"
  engine_version = "18"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name                     = "bench"
  username                    = "app"
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = true
}
