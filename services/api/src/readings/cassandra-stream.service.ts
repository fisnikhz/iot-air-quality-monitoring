import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { CassandraService } from '../cassandra/cassandra.service';
import { ReadingsGateway } from './readings.gateway';

@Injectable()
export class CassandraStreamService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CassandraStreamService.name);
  private readonly seenTimestamps = new Map<string, number>();
  private timer?: NodeJS.Timeout;
  private polling = false;

  constructor(
    private readonly cassandraService: CassandraService,
    private readonly readingsGateway: ReadingsGateway,
  ) {}

  onApplicationBootstrap() {
    const configuredInterval = Number(
      process.env.CASSANDRA_POLL_INTERVAL_MS ?? 1000,
    );
    const intervalMs =
      Number.isFinite(configuredInterval) && configuredInterval >= 250
        ? configuredInterval
        : 1000;

    this.timer = setInterval(() => {
      void this.pollOnce();
    }, intervalMs);
    void this.pollOnce();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async pollOnce() {
    if (this.polling) {
      return;
    }

    this.polling = true;

    try {
      const result = await this.cassandraService.execute<LatestReadingRow>(
        'SELECT * FROM latest_reading_by_device',
      );

      for (const row of result.rows) {
        const timestamp = row.ts.getTime();
        const previousTimestamp = this.seenTimestamps.get(row.device_id) ?? 0;

        if (timestamp <= previousTimestamp) {
          continue;
        }

        this.seenTimestamps.set(row.device_id, timestamp);
        const reading = mapLatestReading(row);
        this.readingsGateway.emitReading(reading);

        if (row.alert_level === 'WARNING' || row.alert_level === 'CRITICAL') {
          this.readingsGateway.emitAlert({
            deviceId: row.device_id,
            locationId: row.location_id,
            timestamp: row.ts,
            alertLevel: row.alert_level,
            message: `Air quality ${row.alert_level}: AQI ${row.aqi}`,
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Cassandra live poll failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.polling = false;
    }
  }
}

function mapLatestReading(row: LatestReadingRow) {
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

type LatestReadingRow = {
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
