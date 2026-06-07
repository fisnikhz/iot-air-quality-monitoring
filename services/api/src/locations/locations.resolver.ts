import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLocationInput } from './dto/create-location.input';
import { UpdateLocationInput } from './dto/update-location.input';
import { LocationsService } from './locations.service';
import { LocationModel } from './models/location.model';

@UseGuards(JwtAuthGuard)
@Resolver(() => LocationModel)
export class LocationsResolver {
  constructor(private readonly locationsService: LocationsService) {}

  @Mutation(() => LocationModel)
  createLocation(@Args('input') input: CreateLocationInput) {
    return this.locationsService.create(input);
  }

  @Query(() => [LocationModel])
  locations() {
    return this.locationsService.findAll();
  }

  @Query(() => LocationModel)
  location(@Args('id') id: string) {
    return this.locationsService.findById(id);
  }

  @Mutation(() => LocationModel)
  updateLocation(@Args('input') input: UpdateLocationInput) {
    return this.locationsService.update(input);
  }

  @Mutation(() => LocationModel)
  removeLocation(@Args('id') id: string) {
    return this.locationsService.remove(id);
  }
}
