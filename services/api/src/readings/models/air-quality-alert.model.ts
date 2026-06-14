import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AirQualityAlertModel {
  @Field()
  deviceId: string;

  @Field()
  locationId: string;

  @Field()
  timestamp: Date;

  @Field()
  alertLevel: string;

  @Field()
  alertType: string;

  @Field()
  message: string;

  @Field()
  metric: string;

  @Field(() => Float)
  metricValue: number;

  @Field(() => Float)
  threshold: number;

  @Field(() => Float)
  anomalyScore: number;
}
