import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  gql,
} from "@apollo/client";

export const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:3000/graphql";
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

export function createApolloClient(token?: string | null) {
  return new ApolloClient({
    link: new HttpLink({
      uri: GRAPHQL_URL,
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    }),
    cache: new InMemoryCache(),
  });
}

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
    }
  }
`;

export const DASHBOARD_QUERY = gql`
  query Dashboard {
    me {
      id
      name
      email
    }
    locations {
      id
      name
      city
      country
      latitude
      longitude
    }
    devices {
      id
      name
      externalId
      locationId
      status
      metrics
    }
  }
`;

export const LATEST_READING_QUERY = gql`
  query LatestReading($deviceId: String!) {
    latestReadingByDevice(deviceId: $deviceId) {
      deviceId
      locationId
      timestamp
      pm25
      pm10
      co2
      temperature
      humidity
      aqi
      anomalyScore
      alertLevel
      qualityStatus
      processedAt
      processingLatencyMs
    }
  }
`;

export const PUBLISH_SIMULATED_READING_MUTATION = gql`
  mutation PublishSimulatedReading(
    $deviceId: String!
    $locationId: String!
    $scenario: String
  ) {
    publishSimulatedReading(
      deviceId: $deviceId
      locationId: $locationId
      scenario: $scenario
    )
  }
`;

export const DEVICE_ANALYTICS_QUERY = gql`
  query DeviceAnalytics($input: ReadingsFilterInput!) {
    readingsByDevice(input: $input) {
      deviceId
      locationId
      timestamp
      pm25
      pm10
      co2
      temperature
      humidity
      aqi
      anomalyScore
      alertLevel
      qualityStatus
      processedAt
      processingLatencyMs
    }
    alertsByDevice(input: $input) {
      deviceId
      locationId
      timestamp
      alertLevel
      alertType
      message
      metric
      metricValue
      threshold
      anomalyScore
    }
    aggregatesByDevice(input: $input) {
      deviceId
      locationId
      windowStart
      windowEnd
      sampleCount
      avgPm25
      avgPm10
      avgCo2
      avgTemperature
      avgHumidity
      avgAqi
      maxAqi
    }
    pipelineMetrics {
      updatedAt
      batchId
      recordsProcessed
      invalidRecords
      alertsGenerated
      avgLatencyMs
      maxLatencyMs
    }
  }
`;

export type User = {
  id: string;
  name: string;
  email: string;
};

export type Location = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
};

export type Device = {
  id: string;
  name: string;
  externalId: string;
  locationId: string;
  status: string;
  metrics: string[];
};

export type AirQualityReading = {
  deviceId: string;
  locationId: string;
  timestamp: string;
  pm25: number;
  pm10: number;
  co2: number;
  temperature: number;
  humidity: number;
  aqi: number;
  anomalyScore?: number | null;
  alertLevel?: string | null;
  qualityStatus?: string | null;
  processedAt?: string | null;
  processingLatencyMs?: number | null;
};

export type AirQualityAlert = {
  deviceId: string;
  locationId: string;
  timestamp: string;
  alertLevel: string;
  alertType: string;
  message: string;
  metric: string;
  metricValue: number;
  threshold: number;
  anomalyScore: number;
};

export type AirQualityAggregate = {
  deviceId: string;
  locationId: string;
  windowStart: string;
  windowEnd: string;
  sampleCount: number;
  avgPm25: number;
  avgPm10: number;
  avgCo2: number;
  avgTemperature: number;
  avgHumidity: number;
  avgAqi: number;
  maxAqi: number;
};

export type PipelineMetrics = {
  updatedAt: string;
  batchId: number;
  recordsProcessed: number;
  invalidRecords: number;
  alertsGenerated: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
};
