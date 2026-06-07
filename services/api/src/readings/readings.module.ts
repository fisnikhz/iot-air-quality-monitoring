import { Module } from '@nestjs/common';
import { CassandraModule } from '../cassandra/cassandra.module';
import { ReadingsService } from './readings.service';
import { ReadingsResolver } from './readings.resolver';

@Module({
  imports: [CassandraModule],
  providers: [ReadingsService, ReadingsResolver],
})
export class ReadingsModule {}
