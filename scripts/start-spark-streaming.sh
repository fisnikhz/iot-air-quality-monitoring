#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" run --rm \
  -e KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092}" \
  -e KAFKA_TOPIC="${KAFKA_TOPIC:-air-quality-readings}" \
  -e CASSANDRA_KEYSPACE="${CASSANDRA_KEYSPACE:-iot_air_quality}" \
  spark \
  spark-submit \
  --master local[*] \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,com.datastax.spark:spark-cassandra-connector_2.12:3.5.1 \
  /opt/spark/jobs/air_quality_stream.py
