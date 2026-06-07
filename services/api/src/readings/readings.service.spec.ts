import { Test, TestingModule } from '@nestjs/testing';
import { CassandraService } from '../cassandra/cassandra.service';
import { ReadingsGateway } from './readings.gateway';
import { ReadingsService } from './readings.service';

describe('ReadingsService', () => {
  let service: ReadingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingsService,
        {
          provide: CassandraService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ReadingsGateway,
          useValue: {
            emitReading: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReadingsService>(ReadingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
