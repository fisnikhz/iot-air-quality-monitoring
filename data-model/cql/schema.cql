CREATE KEYSPACE IF NOT EXISTS iot_air_quality
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

USE iot_air_quality;

CREATE TABLE IF NOT EXISTS readings_by_device_day (
  device_id text,
  day date,
  ts timestamp,
  location_id text,
  pm25 double,
  pm10 double,
  co2 double,
  temperature double,
  humidity double,
  aqi int,
  anomaly_score double,
  alert_level text,
  quality_status text,
  processed_at timestamp,
  processing_latency_ms bigint,
  PRIMARY KEY ((device_id, day), ts)
) WITH CLUSTERING ORDER BY (ts DESC);

CREATE TABLE IF NOT EXISTS readings_by_location_day (
  location_id text,
  day date,
  ts timestamp,
  device_id text,
  pm25 double,
  pm10 double,
  co2 double,
  temperature double,
  humidity double,
  aqi int,
  anomaly_score double,
  alert_level text,
  quality_status text,
  processed_at timestamp,
  processing_latency_ms bigint,
  PRIMARY KEY ((location_id, day), ts, device_id)
) WITH CLUSTERING ORDER BY (ts DESC);

CREATE TABLE IF NOT EXISTS latest_reading_by_device (
  device_id text PRIMARY KEY,
  location_id text,
  ts timestamp,
  pm25 double,
  pm10 double,
  co2 double,
  temperature double,
  humidity double,
  aqi int,
  anomaly_score double,
  alert_level text,
  quality_status text,
  processed_at timestamp,
  processing_latency_ms bigint
);

CREATE TABLE IF NOT EXISTS sensor_metadata_by_id (
  device_id text PRIMARY KEY,
  external_id text,
  name text,
  location_id text,
  location_name text,
  status text,
  metrics set<text>,
  installed_at timestamp,
  last_seen_at timestamp,
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS alerts_by_device_day (
  device_id text,
  day date,
  ts timestamp,
  location_id text,
  alert_level text,
  alert_type text,
  message text,
  metric text,
  metric_value double,
  threshold double,
  anomaly_score double,
  PRIMARY KEY ((device_id, day), ts, alert_type)
) WITH CLUSTERING ORDER BY (ts DESC);

CREATE TABLE IF NOT EXISTS aggregates_by_device_day (
  device_id text,
  day date,
  window_start timestamp,
  window_end timestamp,
  location_id text,
  sample_count bigint,
  avg_pm25 double,
  avg_pm10 double,
  avg_co2 double,
  avg_temperature double,
  avg_humidity double,
  avg_aqi double,
  max_aqi int,
  PRIMARY KEY ((device_id, day), window_start)
) WITH CLUSTERING ORDER BY (window_start DESC);

CREATE TABLE IF NOT EXISTS pipeline_metrics (
  metric_id text PRIMARY KEY,
  updated_at timestamp,
  batch_id bigint,
  records_processed bigint,
  invalid_records bigint,
  alerts_generated bigint,
  avg_latency_ms double,
  max_latency_ms bigint
);

ALTER TABLE readings_by_device_day ADD IF NOT EXISTS anomaly_score double;
ALTER TABLE readings_by_device_day ADD IF NOT EXISTS alert_level text;
ALTER TABLE readings_by_device_day ADD IF NOT EXISTS quality_status text;
ALTER TABLE readings_by_device_day ADD IF NOT EXISTS processed_at timestamp;
ALTER TABLE readings_by_device_day ADD IF NOT EXISTS processing_latency_ms bigint;

ALTER TABLE readings_by_location_day ADD IF NOT EXISTS anomaly_score double;
ALTER TABLE readings_by_location_day ADD IF NOT EXISTS alert_level text;
ALTER TABLE readings_by_location_day ADD IF NOT EXISTS quality_status text;
ALTER TABLE readings_by_location_day ADD IF NOT EXISTS processed_at timestamp;
ALTER TABLE readings_by_location_day ADD IF NOT EXISTS processing_latency_ms bigint;

ALTER TABLE latest_reading_by_device ADD IF NOT EXISTS anomaly_score double;
ALTER TABLE latest_reading_by_device ADD IF NOT EXISTS alert_level text;
ALTER TABLE latest_reading_by_device ADD IF NOT EXISTS quality_status text;
ALTER TABLE latest_reading_by_device ADD IF NOT EXISTS processed_at timestamp;
ALTER TABLE latest_reading_by_device ADD IF NOT EXISTS processing_latency_ms bigint;
