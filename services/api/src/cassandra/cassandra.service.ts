import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, types } from 'cassandra-driver';

@Injectable()
export class CassandraService implements OnModuleDestroy {
  private readonly client: Client;

  constructor(config: ConfigService) {
    const contactPoints = config
      .getOrThrow<string>('CASSANDRA_CONTACT_POINTS')
      .split(',')
      .map((point) => point.trim())
      .filter(Boolean);

    this.client = new Client({
      contactPoints,
      localDataCenter: config.getOrThrow<string>('CASSANDRA_LOCAL_DATACENTER'),
      keyspace: config.getOrThrow<string>('CASSANDRA_KEYSPACE'),
    });
  }

  execute<T = types.Row>(
    query: string,
    params: unknown[] = [],
    options: CassandraQueryOptions = {},
  ) {
    return this.client.execute(query, params, {
      prepare: true,
      ...options,
    }) as Promise<types.ResultSet & { rows: T[] }>;
  }

  onModuleDestroy() {
    return this.client.shutdown();
  }
}

type CassandraQueryOptions = {
  prepare?: boolean;
  consistency?: number;
  fetchSize?: number;
};
