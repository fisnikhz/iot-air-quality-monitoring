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
}
