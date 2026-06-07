#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"
TOPIC="${KAFKA_TOPIC:-air-quality-readings}"

echo "Waiting for Kafka to accept connections..."

until docker compose -f "$COMPOSE_FILE" exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:29092 --list >/dev/null 2>&1; do
  sleep 5
done

echo "Creating Kafka topic: $TOPIC"
docker compose -f "$COMPOSE_FILE" exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka:29092 \
  --create \
  --if-not-exists \
  --topic "$TOPIC" \
  --partitions 1 \
  --replication-factor 1

echo "Kafka topic is ready."
