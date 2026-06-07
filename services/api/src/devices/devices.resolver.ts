import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceModel } from './models/device.model';
import { DevicesService } from './devices.service';
import { CreateDeviceInput } from './dto/create-device.input';
import { UpdateDeviceInput } from './dto/update-device.input';

@UseGuards(JwtAuthGuard)
@Resolver(() => DeviceModel)
export class DevicesResolver {
  constructor(private readonly devicesService: DevicesService) {}

  @Mutation(() => DeviceModel)
  createDevice(@Args('input') input: CreateDeviceInput) {
    return this.devicesService.create(input);
  }

  @Query(() => [DeviceModel])
  devices() {
    return this.devicesService.findAll();
  }

  @Query(() => [DeviceModel])
  devicesByLocation(@Args('locationId') locationId: string) {
    return this.devicesService.findByLocation(locationId);
  }

  @Query(() => DeviceModel)
  device(@Args('id') id: string) {
    return this.devicesService.findById(id);
  }

  @Mutation(() => DeviceModel)
  updateDevice(@Args('input') input: UpdateDeviceInput) {
    return this.devicesService.update(input);
  }

  @Mutation(() => DeviceModel)
  removeDevice(@Args('id') id: string) {
    return this.devicesService.remove(id);
  }
}
