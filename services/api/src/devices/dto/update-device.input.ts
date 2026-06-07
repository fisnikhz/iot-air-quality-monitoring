import { Field, ID, InputType } from '@nestjs/graphql';
import { DeviceStatus, SensorMetric } from '../device.schema';

@InputType()
export class UpdateDeviceInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  externalId?: string;

  @Field(() => ID, { nullable: true })
  locationId?: string;

  @Field(() => DeviceStatus, { nullable: true })
  status?: DeviceStatus;

  @Field(() => [SensorMetric], { nullable: true })
  metrics?: SensorMetric[];

  @Field({ nullable: true })
  installedAt?: Date;

  @Field({ nullable: true })
  lastSeenAt?: Date;
}
