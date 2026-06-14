import { Module } from '@nestjs/common';
import { CassandraModule } from '../cassandra/cassandra.module';
import { ReadingsService } from './readings.service';
import { ReadingsResolver } from './readings.resolver';
import { ReadingsGateway } from './readings.gateway';
import { CassandraStreamService } from './cassandra-stream.service';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  imports: [CassandraModule],
  providers: [
    ReadingsService,
    ReadingsResolver,
    ReadingsGateway,
    CassandraStreamService,
    KafkaProducerService,
  ],
})
export class ReadingsModule {}
