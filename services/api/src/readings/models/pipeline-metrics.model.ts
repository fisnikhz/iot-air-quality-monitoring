import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PipelineMetricsModel {
  @Field()
  updatedAt: Date;

  @Field(() => Int)
  batchId: number;

  @Field(() => Int)
  recordsProcessed: number;

  @Field(() => Int)
  invalidRecords: number;

  @Field(() => Int)
  alertsGenerated: number;

  @Field(() => Float)
  avgLatencyMs: number;

  @Field(() => Float)
  maxLatencyMs: number;
}
