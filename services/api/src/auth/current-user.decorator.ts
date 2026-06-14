import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

export type CurrentUserPayload = {
  userId: string;
  email: string;
};

type AuthenticatedRequest = Request & {
  user: CurrentUserPayload;
};

type GraphQLContext = {
  req: AuthenticatedRequest;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserPayload => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<GraphQLContext>().req.user;
  },
);
