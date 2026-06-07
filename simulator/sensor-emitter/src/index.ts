import { Kafka, type Producer } from 'kafkajs';

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

type ReadingPayload = Omit<
  AirQualityReading,
  'deviceId' | 'locationId' | 'timestamp'
>;

const brokers = env('KAFKA_BROKERS', 'localhost:9092')
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);
const topic = env('KAFKA_TOPIC', 'air-quality-readings');
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
  const kafka = new Kafka({
    clientId: 'sensor-emitter',
    brokers,
  });
  const producer = kafka.producer();

  console.log(`Sensor emitter started for device ${deviceId}`);
  console.log(`Publishing readings to Kafka topic ${topic}`);
  console.log(`Brokers: ${brokers.join(', ')}`);
  console.log(`Interval: ${intervalMs}ms`);

  await producer.connect();

  await emitOnce(producer);
  setInterval(() => {
    emitOnce(producer).catch((error: Error) => {
      console.error(`Failed to emit reading: ${error.message}`);
    });
  }, intervalMs);

  process.on('SIGINT', async () => {
    await producer.disconnect();
    process.exit(0);
  });
}

async function emitOnce(producer: Producer) {
  const reading: AirQualityReading = {
    deviceId,
    locationId,
    timestamp: new Date().toISOString(),
    ...createOutdoorReading(),
  };

  await producer.send({
    topic,
    messages: [
      {
        key: deviceId,
        value: JSON.stringify(reading),
      },
    ],
  });

  console.log(
    `${reading.timestamp} produced AQI=${reading.aqi} PM2.5=${reading.pm25} PM10=${reading.pm10} CO2=${reading.co2}`,
  );
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
