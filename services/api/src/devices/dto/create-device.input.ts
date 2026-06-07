import { Field, ID, InputType } from '@nestjs/graphql';
import { DeviceStatus, SensorMetric } from '../device.schema';

@InputType()
export class CreateDeviceInput {
  @Field()
  name: string;

  @Field()
  externalId: string;

  @Field(() => ID)
  locationId: string;

  @Field(() => DeviceStatus, { nullable: true })
  status?: DeviceStatus;

  @Field(() => [SensorMetric], { nullable: true })
  metrics?: SensorMetric[];

  @Field({ nullable: true })
  installedAt?: Date;
}
