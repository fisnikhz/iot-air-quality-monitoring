import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AirQualityAggregateModel {
  @Field()
  deviceId: string;

  @Field()
  locationId: string;

  @Field()
  windowStart: Date;

  @Field()
  windowEnd: Date;

  @Field(() => Int)
  sampleCount: number;

  @Field(() => Float)
  avgPm25: number;

  @Field(() => Float)
  avgPm10: number;

  @Field(() => Float)
  avgCo2: number;

  @Field(() => Float)
  avgTemperature: number;

  @Field(() => Float)
  avgHumidity: number;

  @Field(() => Float)
  avgAqi: number;

  @Field(() => Int)
  maxAqi: number;
}
