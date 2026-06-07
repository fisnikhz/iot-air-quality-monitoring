import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateReadingInput {
  @Field()
  deviceId: string;

  @Field()
  locationId: string;

  @Field({ nullable: true })
  timestamp?: Date;

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
