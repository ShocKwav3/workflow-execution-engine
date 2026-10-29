variable "TAG" {
  default = "dev"
}

group "default" {
  targets = ["api", "outbox-relay", "executor", "migrate"]
}

target "_common" {
  # Bake resolves paths from the working directory; run it from the repository root.
  context   = "."
  platforms = ["linux/arm64"]
}

target "api" {
  inherits   = ["_common"]
  dockerfile = "docker/app.Dockerfile"
  target     = "api-runtime"
  tags       = ["workflow-engine/api:${TAG}"]
}

target "outbox-relay" {
  inherits   = ["_common"]
  dockerfile = "docker/app.Dockerfile"
  target     = "outbox-relay-runtime"
  tags       = ["workflow-engine/outbox-relay:${TAG}"]
}

target "executor" {
  inherits   = ["_common"]
  dockerfile = "docker/app.Dockerfile"
  target     = "executor-runtime"
  tags       = ["workflow-engine/executor:${TAG}"]
}

target "migrate" {
  inherits   = ["_common"]
  dockerfile = "docker/migrate.Dockerfile"
  target     = "runtime"
  tags       = ["workflow-engine/migrate:${TAG}"]
}
