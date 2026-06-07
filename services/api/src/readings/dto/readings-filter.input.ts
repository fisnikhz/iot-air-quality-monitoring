import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ReadingsFilterInput {
  @Field()
  id: string;

  @Field()
  day: string;

  @Field(() => Int, { nullable: true })
  limit?: number;
}
