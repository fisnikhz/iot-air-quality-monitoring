#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
DOCKER_BIN="${DOCKER_BIN:-$(command -v docker || true)}"

if [[ -z "$DOCKER_BIN" && -x /usr/local/bin/docker ]]; then
  DOCKER_BIN=/usr/local/bin/docker
fi

if [[ -z "$DOCKER_BIN" ]]; then
  echo "Docker CLI was not found. Install Docker Desktop or set DOCKER_BIN." >&2
  exit 1
fi

"$DOCKER_BIN" compose -f "$COMPOSE_FILE" up -d
"$ROOT_DIR/scripts/init-cassandra.sh"
"$ROOT_DIR/scripts/init-kafka.sh"

echo "Local databases are running."
echo "MongoDB:    localhost:27018"
echo "Cassandra: localhost:9042"
echo "Kafka:     localhost:9092"
echo "Kafka UI:  http://localhost:8080"
