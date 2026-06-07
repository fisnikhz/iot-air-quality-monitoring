import { Test, TestingModule } from '@nestjs/testing';
import { DevicesResolver } from './devices.resolver';
import { DevicesService } from './devices.service';

describe('DevicesResolver', () => {
  let resolver: DevicesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesResolver,
        {
          provide: DevicesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findByLocation: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<DevicesResolver>(DevicesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
