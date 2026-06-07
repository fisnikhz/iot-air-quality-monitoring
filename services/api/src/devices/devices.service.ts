import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { CreateDeviceInput } from './dto/create-device.input';
import { UpdateDeviceInput } from './dto/update-device.input';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
  ) {}

  create(input: CreateDeviceInput) {
    return this.deviceModel.create(input);
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

    return device;
  }

  async remove(id: string) {
    const device = await this.deviceModel.findByIdAndDelete(id).exec();

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }
}
