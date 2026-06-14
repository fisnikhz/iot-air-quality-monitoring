import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReadingInput } from './dto/create-reading.input';
import { ReadingsFilterInput } from './dto/readings-filter.input';
import { AirQualityReadingModel } from './models/air-quality-reading.model';
import { ReadingsService } from './readings.service';
import { KafkaProducerService } from './kafka-producer.service';
import { AirQualityAlertModel } from './models/air-quality-alert.model';
import { AirQualityAggregateModel } from './models/air-quality-aggregate.model';
import { PipelineMetricsModel } from './models/pipeline-metrics.model';

@UseGuards(JwtAuthGuard)
@Resolver(() => AirQualityReadingModel)
export class ReadingsResolver {
  constructor(
    private readonly readingsService: ReadingsService,
    private readonly kafkaProducerService: KafkaProducerService,
  ) {}

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

  @Query(() => [AirQualityAlertModel])
  alertsByDevice(@Args('input') input: ReadingsFilterInput) {
    return this.readingsService.findAlertsByDevice(input);
  }

  @Query(() => [AirQualityAggregateModel])
  aggregatesByDevice(@Args('input') input: ReadingsFilterInput) {
    return this.readingsService.findAggregatesByDevice(input);
  }

  @Query(() => PipelineMetricsModel, { nullable: true })
  pipelineMetrics() {
    return this.readingsService.getPipelineMetrics();
  }

  @Mutation(() => Boolean)
  publishSimulatedReading(
    @Args('deviceId') deviceId: string,
    @Args('locationId') locationId: string,
    @Args('scenario', { nullable: true }) scenario?: string,
  ) {
    return this.kafkaProducerService.publishSimulatedReading(
      deviceId,
      locationId,
      scenario,
    );
  }
}
