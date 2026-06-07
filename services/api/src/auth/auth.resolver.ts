import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './auth.types';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthResponse)
  register(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    return this.authService.register(name, email, password);
  }

  @Mutation(() => AuthResponse)
  login(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    return this.authService.login(email, password);
  }
}