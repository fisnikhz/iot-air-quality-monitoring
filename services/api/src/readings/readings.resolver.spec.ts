import { Test, TestingModule } from '@nestjs/testing';
import { ReadingsResolver } from './readings.resolver';
import { ReadingsService } from './readings.service';

describe('ReadingsResolver', () => {
  let resolver: ReadingsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingsResolver,
        {
          provide: ReadingsService,
          useValue: {
            create: jest.fn(),
            latestByDevice: jest.fn(),
            findByDevice: jest.fn(),
            findByLocation: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<ReadingsResolver>(ReadingsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
