import { Injectable } from '@nestjs/common';
import { CassandraService } from '../cassandra/cassandra.service';
import { CreateReadingInput } from './dto/create-reading.input';
import { ReadingsFilterInput } from './dto/readings-filter.input';
import { ReadingsGateway } from './readings.gateway';
import { AirQualityReadingModel } from './models/air-quality-reading.model';

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

    return result.rows.map((row) => this.mapRow(row as unknown as ReadingRow));
  }

  async findByLocation(input: ReadingsFilterInput) {
    const result = await this.cassandraService.execute<ReadingRow>(
      'SELECT * FROM readings_by_location_day WHERE location_id = ? AND day = ? LIMIT ?',
      [input.id, input.day, input.limit ?? 100],
    );

    return result.rows.map((row) => this.mapRow(row as unknown as ReadingRow));
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
};
