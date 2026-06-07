type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type LoginResponse = {
  login: {
    accessToken: string;
  };
};

type ReadingResponse = {
  createReading: AirQualityReading;
};

type AirQualityReading = {
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

type ReadingPayload = Omit<AirQualityReading, 'deviceId' | 'locationId' | 'timestamp'>;

const apiUrl = env('API_URL', 'http://localhost:3000/graphql');
const deviceId = requiredEnv('DEVICE_ID');
const locationId = requiredEnv('LOCATION_ID');
const intervalMs = Number(env('INTERVAL_MS', '5000'));

if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
  throw new Error('INTERVAL_MS must be a number greater than or equal to 1000');
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const token = await getAuthToken();

  console.log(`Sensor emitter started for device ${deviceId}`);
  console.log(`Sending readings to ${apiUrl} every ${intervalMs}ms`);

  await emitOnce(token);
  setInterval(() => {
    emitOnce(token).catch((error: Error) => {
      console.error(`Failed to emit reading: ${error.message}`);
    });
  }, intervalMs);
}

async function getAuthToken() {
  const token = env('AUTH_TOKEN', '');

  if (token) {
    return token;
  }

  const email = requiredEnv('SIM_EMAIL');
  const password = requiredEnv('SIM_PASSWORD');
  const response = await graphql<LoginResponse>({
    query: `mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        accessToken
      }
    }`,
    variables: { email, password },
  });

  return response.login.accessToken;
}

async function emitOnce(token: string) {
  const reading = createOutdoorReading();
  const response = await graphql<ReadingResponse>(
    {
      query: `mutation CreateReading($input: CreateReadingInput!) {
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
      }`,
      variables: {
        input: {
          deviceId,
          locationId,
          ...reading,
        },
      },
    },
    token,
  );

  const saved = response.createReading;
  console.log(
    `${saved.timestamp} AQI=${saved.aqi} PM2.5=${saved.pm25} PM10=${saved.pm10} CO2=${saved.co2}`,
  );
}

async function graphql<T>(
  body: {
    query: string;
    variables?: Record<string, unknown>;
  },
  token?: string,
) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as GraphqlResponse<T>;

  if (!response.ok || payload.errors?.length || !payload.data) {
    const message =
      payload.errors?.map((error) => error.message).join('; ') ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

function createOutdoorReading(): ReadingPayload {
  const pm25 = round(randomBetween(4, 38));
  const pm10 = round(pm25 + randomBetween(6, 32));
  const co2 = round(randomBetween(380, 720));
  const temperature = round(randomBetween(5, 34));
  const humidity = round(randomBetween(30, 85));

  return {
    pm25,
    pm10,
    co2,
    temperature,
    humidity,
    aqi: calculateAqi(pm25, pm10),
  };
}

function calculateAqi(pm25: number, pm10: number) {
  const pm25Score = (pm25 / 35.4) * 100;
  const pm10Score = (pm10 / 154) * 100;
  return Math.max(1, Math.round(Math.max(pm25Score, pm10Score)));
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function env(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
