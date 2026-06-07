import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum SensorMetric {
  PM25 = 'PM25',
  PM10 = 'PM10',
  CO2 = 'CO2',
  TEMPERATURE = 'TEMPERATURE',
  HUMIDITY = 'HUMIDITY',
  AQI = 'AQI',
}

@Schema({ timestamps: true })
export class Device {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  externalId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Location' })
  locationId: Types.ObjectId;

  @Prop({
    required: true,
    enum: DeviceStatus,
    default: DeviceStatus.ACTIVE,
  })
  status: DeviceStatus;

  @Prop({
    required: true,
    type: [String],
    enum: SensorMetric,
    default: [
      SensorMetric.PM25,
      SensorMetric.PM10,
      SensorMetric.CO2,
      SensorMetric.TEMPERATURE,
      SensorMetric.HUMIDITY,
      SensorMetric.AQI,
    ],
  })
  metrics: SensorMetric[];

  @Prop()
  installedAt?: Date;

  @Prop()
  lastSeenAt?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
