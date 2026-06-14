import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AirQualityReadingModel {
  @Field()
  deviceId: string;

  @Field()
  locationId: string;

  @Field()
  timestamp: Date;

  @Field(() => Float)
  pm25: number;

  @Field(() => Float)
  pm10: number;

  @Field(() => Float)
  co2: number;

  @Field(() => Float)
  temperature: number;

  @Field(() => Float)
  humidity: number;

  @Field(() => Int)
  aqi: number;

  @Field(() => Float, { nullable: true })
  anomalyScore?: number;

  @Field({ nullable: true })
  alertLevel?: string;

  @Field({ nullable: true })
  qualityStatus?: string;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field(() => Float, { nullable: true })
  processingLatencyMs?: number;
}
