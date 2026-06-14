# IoT Air Quality Monitoring

Real-time university IoT project implementing the complete required flow:

`sensor simulator -> Apache Kafka -> Apache Spark Structured Streaming -> Apache Cassandra -> NestJS GraphQL/WebSocket API -> Next.js dashboard`

## Implemented requirements

- Air-quality sensor simulator with PM2.5, PM10, CO2, temperature, humidity, and AQI.
- Kafka producer and dedicated `air-quality-readings` topic.
- Spark Structured Streaming consumer with schema validation and range validation.
- Multi-signal anomaly scoring and warning/critical alert classification.
- One-minute rolling windows sliding every ten seconds.
- Cassandra tables for raw readings, latest readings, sensor metadata, alerts, aggregates, and pipeline performance.
- Live web dashboard driven by Spark-processed Cassandra data.
- Interactive station map with one pin per location and click-to-inspect sensors.
- Simulation laboratory for normal, pollution, CO2, drift, and broken-sensor scenarios.
- GraphQL historical queries and Socket.IO live updates.
- Reproducible demo user, location, device, and Cassandra metadata seed.

## Prerequisites

- Docker with Docker Compose
- Node.js 20 or newer
- npm

## First-time setup

```bash
cp services/api/.env.example services/api/.env
cp apps/web/.env.local.example apps/web/.env.local

cd services/api && npm install
cd ../../apps/web && npm install
cd ../../simulator/sensor-emitter && npm install
cd ../..
```

Start MongoDB, Cassandra, Kafka, and Kafka UI:

```bash
./scripts/start-local.sh
```

Seed the demonstration account and sensor metadata:

```bash
cd services/api
npm run seed
```

Demo credentials:

```text
fisnik@example.com
password123
```

## Run the complete pipeline

Use four terminals from the repository root.

Terminal 1, Spark:

```bash
./scripts/start-spark-streaming.sh
```

Terminal 2, API:

```bash
cd services/api
npm run start:dev
```

Terminal 3, dashboard:

```bash
cd apps/web
npm run dev -- -p 3001
```

Terminal 4 is optional because the dashboard can publish simulated events
through Kafka itself. To use the standalone simulator:

```bash
cd simulator/sensor-emitter
cp .env.example .env
# Set DEVICE_ID and LOCATION_ID to the values displayed by the API or MongoDB.
set -a
source .env
set +a
npm run start
```

Open:

- Dashboard: http://localhost:3001
- Station map: http://localhost:3001/map
- Simulation laboratory: http://localhost:3001/simulation
- GraphQL playground: http://localhost:3000/graphql
- Kafka UI: http://localhost:8080

## Live demonstration sequence

1. Open Kafka UI and show the `air-quality-readings` topic.
2. Sign in to the dashboard.
3. Click **Start Kafka stream**.
4. Show new Kafka messages arriving.
5. Show Spark micro-batches processing records.
6. Show Cassandra rows:

```sql
SELECT * FROM iot_air_quality.latest_reading_by_device;
SELECT * FROM iot_air_quality.alerts_by_device_day;
SELECT * FROM iot_air_quality.aggregates_by_device_day;
SELECT * FROM iot_air_quality.sensor_metadata_by_id;
SELECT * FROM iot_air_quality.pipeline_metrics;
```

7. Return to the dashboard and show live values, charts, alerts, anomaly score,
   and processing latency.
8. Open the station map and click pins to compare station health.
9. Open the simulation laboratory and run `BROKEN_SENSOR` to demonstrate Spark
   data-quality rejection, then run `POLLUTION_SPIKE` to demonstrate alarms.

## Processing logic

Spark rejects records outside plausible sensor ranges. Valid records receive:

- `anomaly_score`: maximum normalized deviation across all measured signals.
- `alert_level`: `NORMAL`, `WARNING`, or `CRITICAL`.
- `processing_latency_ms`: event timestamp to Spark processing time.
- rolling averages and maximum AQI over one-minute windows.

Alert rules:

- Critical when AQI is at least 151 or CO2 is at least 2000 ppm.
- Warning when AQI is at least 101, CO2 is at least 1200 ppm, or anomaly score
  is at least 2.5.

## Verification

```bash
./scripts/verify-project.sh
```

With the infrastructure, Spark, API, and seeded data running, verify the
complete live pipeline:

```bash
E2E=1 ./scripts/verify-project.sh
```

The live check publishes normal, pollution, and broken-sensor scenarios and
asserts Kafka/Spark/Cassandra processing, alerts, rolling aggregates,
data-quality rejection, performance metrics, and Socket.IO delivery.

The final project report is
`docs/IoT_Air_Quality_Monitoring_Report.docx`.
