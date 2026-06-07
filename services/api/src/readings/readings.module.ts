import { Module } from '@nestjs/common';
import { CassandraModule } from '../cassandra/cassandra.module';
import { ReadingsService } from './readings.service';
import { ReadingsResolver } from './readings.resolver';
import { ReadingsGateway } from './readings.gateway';

@Module({
  imports: [CassandraModule],
  providers: [ReadingsService, ReadingsResolver, ReadingsGateway],
})
export class ReadingsModule {}
