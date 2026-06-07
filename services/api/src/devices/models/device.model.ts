import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { DeviceStatus, SensorMetric } from '../device.schema';

registerEnumType(DeviceStatus, {
  name: 'DeviceStatus',
});

registerEnumType(SensorMetric, {
  name: 'SensorMetric',
});

@ObjectType()
export class DeviceModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  externalId: string;

  @Field(() => ID)
  locationId: string;

  @Field(() => DeviceStatus)
  status: DeviceStatus;

  @Field(() => [SensorMetric])
  metrics: SensorMetric[];

  @Field({ nullable: true })
  installedAt?: Date;

  @Field({ nullable: true })
  lastSeenAt?: Date;
}
