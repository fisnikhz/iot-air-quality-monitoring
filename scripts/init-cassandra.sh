#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
SCHEMA_FILE="$ROOT_DIR/data-model/cql/schema.cql"
CONTAINER_NAME="iot-cassandra"
DOCKER_BIN="${DOCKER_BIN:-$(command -v docker || true)}"

if [[ -z "$DOCKER_BIN" && -x /usr/local/bin/docker ]]; then
  DOCKER_BIN=/usr/local/bin/docker
fi

echo "Waiting for Cassandra to accept CQL connections..."

until "$DOCKER_BIN" compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh -e "DESCRIBE KEYSPACES" >/dev/null 2>&1; do
  sleep 5
done

echo "Applying Cassandra schema..."
"$DOCKER_BIN" compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh < "$SCHEMA_FILE"

echo "Cassandra schema is ready."
