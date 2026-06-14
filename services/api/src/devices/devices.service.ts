import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { CreateDeviceInput } from './dto/create-device.input';
import { UpdateDeviceInput } from './dto/update-device.input';
import { CassandraService } from '../cassandra/cassandra.service';
import { LocationsService } from '../locations/locations.service';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly cassandraService: CassandraService,
    private readonly locationsService: LocationsService,
  ) {}

  async create(input: CreateDeviceInput) {
    const device = await this.deviceModel.create(input);
    await this.syncMetadata(device);
    return device;
  }

  findAll() {
    return this.deviceModel.find().sort({ name: 1 }).exec();
  }

  findByLocation(locationId: string) {
    return this.deviceModel.find({ locationId }).sort({ name: 1 }).exec();
  }

  async findById(id: string) {
    const device = await this.deviceModel.findById(id).exec();

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.syncMetadata(device);
    return device;
  }

  async update(input: UpdateDeviceInput) {
    const { id, ...data } = input;
    const device = await this.deviceModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.syncMetadata(device);
    return device;
  }

  async remove(id: string) {
    const device = await this.deviceModel.findByIdAndDelete(id).exec();

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.cassandraService.execute(
      'DELETE FROM sensor_metadata_by_id WHERE device_id = ?',
      [String(device._id)],
    );
    return device;
  }

  private async syncMetadata(device: DeviceDocument) {
    const deviceId = String(device._id);
    const locationId = String(device.locationId);
    const location = await this.locationsService.findById(locationId);

    await this.cassandraService.execute(
      `INSERT INTO sensor_metadata_by_id
      (device_id, external_id, name, location_id, location_name, status, metrics,
       installed_at, last_seen_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        device.externalId,
        device.name,
        locationId,
        location.name,
        device.status,
        device.metrics,
        device.installedAt ?? null,
        device.lastSeenAt ?? null,
        new Date(),
      ],
    );
  }
}
