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
  aqi int
);
