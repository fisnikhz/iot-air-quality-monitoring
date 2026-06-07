import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateLocationInput } from './dto/create-location.input';
import { UpdateLocationInput } from './dto/update-location.input';
import { Location, LocationDocument } from './location.schema';

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
  ) {}

  create(input: CreateLocationInput) {
    return this.locationModel.create(input);
  }

  findAll() {
    return this.locationModel.find().sort({ name: 1 }).exec();
  }

  async findById(id: string) {
    const location = await this.locationModel.findById(id).exec();

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  async update(input: UpdateLocationInput) {
    const { id, ...data } = input;
    const location = await this.locationModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  async remove(id: string) {
    const location = await this.locationModel.findByIdAndDelete(id).exec();

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }
}
