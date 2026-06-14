import { Test, TestingModule } from '@nestjs/testing';
import { CassandraService } from '../cassandra/cassandra.service';
import { CassandraStreamService } from './cassandra-stream.service';
import { ReadingsGateway } from './readings.gateway';

describe('CassandraStreamService', () => {
  let service: CassandraStreamService;
  let execute: jest.Mock;
  let emitReading: jest.Mock;
  let emitAlert: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn();
    emitReading = jest.fn();
    emitAlert = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CassandraStreamService,
        {
          provide: CassandraService,
          useValue: { execute },
        },
        {
          provide: ReadingsGateway,
          useValue: { emitReading, emitAlert },
        },
      ],
    }).compile();

    service = module.get(CassandraStreamService);
  });

  it('emits each new Cassandra timestamp once', async () => {
    execute.mockResolvedValue({
      rows: [createRow('2026-06-13T12:00:00.000Z')],
    });

    await service.pollOnce();
    await service.pollOnce();

    expect(emitReading).toHaveBeenCalledTimes(1);
    expect(emitReading).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        timestamp: new Date('2026-06-13T12:00:00.000Z'),
        processingLatencyMs: 125,
      }),
    );
  });

  it('emits a later row and its alert', async () => {
    execute
      .mockResolvedValueOnce({
        rows: [createRow('2026-06-13T12:00:00.000Z')],
      })
      .mockResolvedValueOnce({
        rows: [createRow('2026-06-13T12:00:01.000Z', 'WARNING')],
      });

    await service.pollOnce();
    await service.pollOnce();

    expect(emitReading).toHaveBeenCalledTimes(2);
    expect(emitAlert).toHaveBeenCalledTimes(1);
    expect(emitAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        alertLevel: 'WARNING',
      }),
    );
  });
});

function createRow(timestamp: string, alertLevel = 'NORMAL') {
  return {
    device_id: 'device-1',
    location_id: 'location-1',
    ts: new Date(timestamp),
    pm25: 20,
    pm10: 35,
    co2: 500,
    temperature: 22,
    humidity: 48,
    aqi: 50,
    anomaly_score: 1.2,
    alert_level: alertLevel,
    quality_status: 'VALID',
    processed_at: new Date(new Date(timestamp).getTime() + 125),
    processing_latency_ms: 125,
  };
}
