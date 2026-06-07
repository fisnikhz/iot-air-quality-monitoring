#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
SCHEMA_FILE="$ROOT_DIR/data-model/cql/schema.cql"
CONTAINER_NAME="iot-cassandra"

echo "Waiting for Cassandra to accept CQL connections..."

until docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh -e "DESCRIBE KEYSPACES" >/dev/null 2>&1; do
  sleep 5
done

echo "Applying Cassandra schema..."
docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh < "$SCHEMA_FILE"

echo "Cassandra schema is ready."
