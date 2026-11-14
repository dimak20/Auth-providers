resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/auth-providers-api"
  retention_in_days = 30
}

resource "aws_iam_role" "task_execution" {
  name               = "auth-providers-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_extra" {
  name   = "read-app-config"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_extra.json
}
