import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReadingInput } from './dto/create-reading.input';
import { ReadingsFilterInput } from './dto/readings-filter.input';
import { AirQualityReadingModel } from './models/air-quality-reading.model';
import { ReadingsService } from './readings.service';

@UseGuards(JwtAuthGuard)
@Resolver(() => AirQualityReadingModel)
export class ReadingsResolver {
  constructor(private readonly readingsService: ReadingsService) {}

  @Mutation(() => AirQualityReadingModel)
  createReading(@Args('input') input: CreateReadingInput) {
    return this.readingsService.create(input);
  }

  @Query(() => AirQualityReadingModel, { nullable: true })
  latestReadingByDevice(@Args('deviceId') deviceId: string) {
    return this.readingsService.latestByDevice(deviceId);
  }

  @Query(() => [AirQualityReadingModel])
  readingsByDevice(@Args('input') input: ReadingsFilterInput) {
    return this.readingsService.findByDevice(input);
  }

  @Query(() => [AirQualityReadingModel])
  readingsByLocation(@Args('input') input: ReadingsFilterInput) {
    return this.readingsService.findByLocation(input);
  }
}
