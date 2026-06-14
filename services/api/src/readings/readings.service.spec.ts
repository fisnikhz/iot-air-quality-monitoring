import { Test, TestingModule } from '@nestjs/testing';
import { CassandraService } from '../cassandra/cassandra.service';
import { ReadingsGateway } from './readings.gateway';
import { ReadingsService } from './readings.service';

describe('ReadingsService', () => {
  let service: ReadingsService;
  let execute: jest.Mock;
  let emitReading: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn();
    emitReading = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingsService,
        {
          provide: CassandraService,
          useValue: {
            execute,
          },
        },
        {
          provide: ReadingsGateway,
          useValue: {
            emitReading,
          },
        },
      ],
    }).compile();

    service = module.get<ReadingsService>(ReadingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('writes a manually ingested reading to all Cassandra projections', async () => {
    execute.mockResolvedValue({ rows: [] });
    const timestamp = new Date('2026-06-13T12:00:00.000Z');
    const input = {
      deviceId: 'device-1',
      locationId: 'location-1',
      timestamp,
      pm25: 12,
      pm10: 25,
      co2: 450,
      temperature: 22,
      humidity: 48,
      aqi: 34,
    };

    await service.create(input);

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('readings_by_device_day'),
      expect.any(Array),
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('readings_by_location_day'),
      expect.any(Array),
    );
    expect(execute).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('latest_reading_by_device'),
      expect.any(Array),
    );
    expect(emitReading).toHaveBeenCalledWith(input);
  });

  it('maps enriched Cassandra fields for the latest device reading', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          device_id: 'device-1',
          location_id: 'location-1',
          ts: new Date('2026-06-13T12:00:00.000Z'),
          pm25: 40,
          pm10: 70,
          co2: 1300,
          temperature: 24,
          humidity: 55,
          aqi: 120,
          anomaly_score: 2.8,
          alert_level: 'WARNING',
          quality_status: 'VALID',
          processed_at: new Date('2026-06-13T12:00:00.250Z'),
          processing_latency_ms: 250,
        },
      ],
    });

    await expect(service.latestByDevice('device-1')).resolves.toMatchObject({
      deviceId: 'device-1',
      anomalyScore: 2.8,
      alertLevel: 'WARNING',
      qualityStatus: 'VALID',
      processingLatencyMs: 250,
    });
  });

  it('returns pipeline performance metrics', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          updated_at: new Date('2026-06-13T12:00:01.000Z'),
          batch_id: 7,
          records_processed: 12,
          invalid_records: 1,
          alerts_generated: 2,
          avg_latency_ms: 180.5,
          max_latency_ms: 310,
        },
      ],
    });

    await expect(service.getPipelineMetrics()).resolves.toMatchObject({
      batchId: 7,
      recordsProcessed: 12,
      invalidRecords: 1,
      alertsGenerated: 2,
      avgLatencyMs: 180.5,
      maxLatencyMs: 310,
    });
  });
});
