#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" up -d
"$ROOT_DIR/scripts/init-cassandra.sh"
"$ROOT_DIR/scripts/init-kafka.sh"

echo "Local databases are running."
echo "MongoDB:    localhost:27018"
echo "Cassandra: localhost:9042"
echo "Kafka:     localhost:9092"
echo "Kafka UI:  http://localhost:8080"
