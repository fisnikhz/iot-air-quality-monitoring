import { Test, TestingModule } from '@nestjs/testing';
import { LocationsResolver } from './locations.resolver';
import { LocationsService } from './locations.service';

describe('LocationsResolver', () => {
  let resolver: LocationsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsResolver,
        {
          provide: LocationsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<LocationsResolver>(LocationsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
