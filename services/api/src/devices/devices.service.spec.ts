import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Device } from './device.schema';
import { DevicesService } from './devices.service';
import { CassandraService } from '../cassandra/cassandra.service';
import { LocationsService } from '../locations/locations.service';

describe('DevicesService', () => {
  let service: DevicesService;
  let create: jest.Mock;
  let execute: jest.Mock;
  let findById: jest.Mock;
  let findByIdAndUpdate: jest.Mock;

  beforeEach(async () => {
    create = jest.fn();
    execute = jest.fn();
    findById = jest.fn();
    findByIdAndUpdate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: getModelToken(Device.name),
          useValue: {
            create,
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate,
            findByIdAndDelete: jest.fn(),
          },
        },
        {
          provide: CassandraService,
          useValue: {
            execute,
          },
        },
        {
          provide: LocationsService,
          useValue: {
            findById,
          },
        },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('mirrors created sensor metadata to Cassandra', async () => {
    const installedAt = new Date('2026-06-13T10:00:00.000Z');
    create.mockResolvedValue({
      _id: 'device-1',
      externalId: 'AQ-001',
      name: 'Outdoor Sensor',
      locationId: 'location-1',
      status: 'ACTIVE',
      metrics: ['PM25', 'AQI'],
      installedAt,
    });
    findById.mockResolvedValue({
      _id: 'location-1',
      name: 'Campus',
    });
    execute.mockResolvedValue({ rows: [] });

    await service.create({
      name: 'Outdoor Sensor',
      externalId: 'AQ-001',
      locationId: 'location-1',
      installedAt,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('sensor_metadata_by_id'),
      expect.arrayContaining([
        'device-1',
        'AQ-001',
        'Outdoor Sensor',
        'location-1',
        'Campus',
      ]),
    );
  });

  it('refreshes Cassandra metadata after a device update', async () => {
    findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: 'device-1',
        externalId: 'AQ-001',
        name: 'Updated Sensor',
        locationId: 'location-1',
        status: 'MAINTENANCE',
        metrics: ['PM25', 'AQI'],
      }),
    });
    findById.mockResolvedValue({
      _id: 'location-1',
      name: 'Campus',
    });
    execute.mockResolvedValue({ rows: [] });

    await service.update({
      id: 'device-1',
      name: 'Updated Sensor',
      status: 'MAINTENANCE',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('sensor_metadata_by_id'),
      expect.arrayContaining([
        'device-1',
        'AQ-001',
        'Updated Sensor',
        'location-1',
        'Campus',
        'MAINTENANCE',
      ]),
    );
  });
});
