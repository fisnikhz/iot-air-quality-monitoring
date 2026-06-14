import { Injectable } from '@nestjs/common';
import { CassandraService } from '../cassandra/cassandra.service';
import { CreateReadingInput } from './dto/create-reading.input';
import { ReadingsFilterInput } from './dto/readings-filter.input';
import { ReadingsGateway } from './readings.gateway';
import { AirQualityReadingModel } from './models/air-quality-reading.model';
import { AirQualityAlertModel } from './models/air-quality-alert.model';
import { AirQualityAggregateModel } from './models/air-quality-aggregate.model';
import { PipelineMetricsModel } from './models/pipeline-metrics.model';

@Injectable()
export class ReadingsService {
  constructor(
    private readonly cassandraService: CassandraService,
    private readonly readingsGateway: ReadingsGateway,
  ) {}

  async create(input: CreateReadingInput) {
    const timestamp = input.timestamp ?? new Date();
    const day = this.toDay(timestamp);
    const reading = {
      ...input,
      timestamp,
    };

    await this.cassandraService.execute(
      `INSERT INTO readings_by_device_day
      (device_id, day, ts, location_id, pm25, pm10, co2, temperature, humidity, aqi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.deviceId,
        day,
        timestamp,
        input.locationId,
        input.pm25,
        input.pm10,
        input.co2,
        input.temperature,
        input.humidity,
        input.aqi,
      ],
    );

    await this.cassandraService.execute(
      `INSERT INTO readings_by_location_day
      (location_id, day, ts, device_id, pm25, pm10, co2, temperature, humidity, aqi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.locationId,
        day,
        timestamp,
        input.deviceId,
        input.pm25,
        input.pm10,
        input.co2,
        input.temperature,
        input.humidity,
        input.aqi,
      ],
    );

    await this.cassandraService.execute(
      `INSERT INTO latest_reading_by_device
      (device_id, location_id, ts, pm25, pm10, co2, temperature, humidity, aqi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.deviceId,
        input.locationId,
        timestamp,
        input.pm25,
        input.pm10,
        input.co2,
        input.temperature,
        input.humidity,
        input.aqi,
      ],
    );

    this.readingsGateway.emitReading(reading);

    return reading;
  }

  async latestByDevice(deviceId: string) {
    const result = await this.cassandraService.execute<ReadingRow>(
      'SELECT * FROM latest_reading_by_device WHERE device_id = ?',
      [deviceId],
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findByDevice(input: ReadingsFilterInput) {
    const result = await this.cassandraService.execute<ReadingRow>(
      'SELECT * FROM readings_by_device_day WHERE device_id = ? AND day = ? LIMIT ?',
      [input.id, input.day, input.limit ?? 100],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findByLocation(input: ReadingsFilterInput) {
    const result = await this.cassandraService.execute<ReadingRow>(
      'SELECT * FROM readings_by_location_day WHERE location_id = ? AND day = ? LIMIT ?',
      [input.id, input.day, input.limit ?? 100],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findAlertsByDevice(
    input: ReadingsFilterInput,
  ): Promise<AirQualityAlertModel[]> {
    const result = await this.cassandraService.execute<AlertRow>(
      'SELECT * FROM alerts_by_device_day WHERE device_id = ? AND day = ? LIMIT ?',
      [input.id, input.day, input.limit ?? 20],
    );

    return result.rows.map((row) => ({
      deviceId: row.device_id,
      locationId: row.location_id,
      timestamp: row.ts,
      alertLevel: row.alert_level,
      alertType: row.alert_type,
      message: row.message,
      metric: row.metric,
      metricValue: row.metric_value,
      threshold: row.threshold,
      anomalyScore: row.anomaly_score,
    }));
  }

  async findAggregatesByDevice(
    input: ReadingsFilterInput,
  ): Promise<AirQualityAggregateModel[]> {
    const result = await this.cassandraService.execute<AggregateRow>(
      'SELECT * FROM aggregates_by_device_day WHERE device_id = ? AND day = ? LIMIT ?',
      [input.id, input.day, input.limit ?? 30],
    );

    return result.rows.map((row) => ({
      deviceId: row.device_id,
      locationId: row.location_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      sampleCount: Number(row.sample_count),
      avgPm25: row.avg_pm25,
      avgPm10: row.avg_pm10,
      avgCo2: row.avg_co2,
      avgTemperature: row.avg_temperature,
      avgHumidity: row.avg_humidity,
      avgAqi: row.avg_aqi,
      maxAqi: row.max_aqi,
    }));
  }

  async getPipelineMetrics(): Promise<PipelineMetricsModel | null> {
    const result = await this.cassandraService.execute<PipelineMetricsRow>(
      'SELECT * FROM pipeline_metrics WHERE metric_id = ?',
      ['latest'],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      updatedAt: row.updated_at,
      batchId: Number(row.batch_id),
      recordsProcessed: Number(row.records_processed),
      invalidRecords: Number(row.invalid_records),
      alertsGenerated: Number(row.alerts_generated),
      avgLatencyMs: row.avg_latency_ms,
      maxLatencyMs: Number(row.max_latency_ms),
    };
  }

  private toDay(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private mapRow(row: ReadingRow): AirQualityReadingModel {
    return {
      deviceId: row.device_id,
      locationId: row.location_id,
      timestamp: row.ts,
      pm25: row.pm25,
      pm10: row.pm10,
      co2: row.co2,
      temperature: row.temperature,
      humidity: row.humidity,
      aqi: row.aqi,
      anomalyScore: row.anomaly_score,
      alertLevel: row.alert_level,
      qualityStatus: row.quality_status,
      processedAt: row.processed_at,
      processingLatencyMs: Number(row.processing_latency_ms ?? 0),
    };
  }
}

type ReadingRow = {
  device_id: string;
  location_id: string;
  ts: Date;
  pm25: number;
  pm10: number;
  co2: number;
  temperature: number;
  humidity: number;
  aqi: number;
  anomaly_score?: number;
  alert_level?: string;
  quality_status?: string;
  processed_at?: Date;
  processing_latency_ms?: number;
};

type AlertRow = {
  device_id: string;
  location_id: string;
  ts: Date;
  alert_level: string;
  alert_type: string;
  message: string;
  metric: string;
  metric_value: number;
  threshold: number;
  anomaly_score: number;
};

type AggregateRow = {
  device_id: string;
  location_id: string;
  window_start: Date;
  window_end: Date;
  sample_count: number;
  avg_pm25: number;
  avg_pm10: number;
  avg_co2: number;
  avg_temperature: number;
  avg_humidity: number;
  avg_aqi: number;
  max_aqi: number;
};

type PipelineMetricsRow = {
  updated_at: Date;
  batch_id: number;
  records_processed: number;
  invalid_records: number;
  alerts_generated: number;
  avg_latency_ms: number;
  max_latency_ms: number;
};
