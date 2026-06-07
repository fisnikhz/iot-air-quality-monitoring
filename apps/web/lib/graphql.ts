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
    }
  }
`;

export const CREATE_READING_MUTATION = gql`
  mutation CreateReading($input: CreateReadingInput!) {
    createReading(input: $input) {
      deviceId
      locationId
      timestamp
      pm25
      pm10
      co2
      temperature
      humidity
      aqi
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
};
