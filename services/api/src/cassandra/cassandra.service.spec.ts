import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CassandraService } from './cassandra.service';

describe('CassandraService', () => {
  let service: CassandraService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CassandraService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const values: Record<string, string> = {
                CASSANDRA_CONTACT_POINTS: '127.0.0.1',
                CASSANDRA_LOCAL_DATACENTER: 'datacenter1',
                CASSANDRA_KEYSPACE: 'iot_air_quality',
              };

              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CassandraService>(CassandraService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
