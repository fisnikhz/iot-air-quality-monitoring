import { NotFoundException, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserModel } from './models/user.model';
import { UsersService } from './users.service';

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => UserModel)
  async me(@CurrentUser() user: CurrentUserPayload) {
    const foundUser = await this.usersService.findById(user.userId);

    if (!foundUser) {
      throw new NotFoundException('User not found');
    }

    return {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
    };
  }
}
