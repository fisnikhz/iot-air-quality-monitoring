import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleDestroy {
  private readonly producer: Producer;
  private readonly topic: string;
  private connected = false;

  constructor(config: ConfigService) {
    const brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);

    this.topic = config.get<string>('KAFKA_TOPIC') ?? 'air-quality-readings';
    this.producer = new Kafka({
      clientId: 'iot-air-quality-api',
      brokers,
    }).producer();
  }

  async publishSimulatedReading(
    deviceId: string,
    locationId: string,
    scenario = 'NORMAL',
  ) {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }

    const values = createScenarioReading(scenario);
    const reading = {
      deviceId,
      locationId,
      timestamp: new Date().toISOString(),
      ...values,
      aqi: calculateAqi(values.pm25, values.pm10),
    };

    await this.producer.send({
      topic: this.topic,
      messages: [{ key: deviceId, value: JSON.stringify(reading) }],
    });

    return true;
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.producer.disconnect();
    }
  }
}

function createScenarioReading(scenario: string) {
  switch (scenario.toUpperCase()) {
    case 'POLLUTION_SPIKE': {
      const pm25 = round(randomBetween(90, 180));
      return {
        pm25,
        pm10: round(pm25 + randomBetween(60, 140)),
        co2: round(randomBetween(700, 1100)),
        temperature: round(randomBetween(18, 32)),
        humidity: round(randomBetween(35, 75)),
      };
    }
    case 'CO2_SPIKE': {
      const pm25 = round(randomBetween(8, 30));
      return {
        pm25,
        pm10: round(pm25 + randomBetween(8, 30)),
        co2: round(randomBetween(2100, 4200)),
        temperature: round(randomBetween(18, 30)),
        humidity: round(randomBetween(35, 70)),
      };
    }
    case 'SENSOR_DRIFT': {
      const pm25 = round(randomBetween(45, 85));
      return {
        pm25,
        pm10: round(pm25 + randomBetween(30, 70)),
        co2: round(randomBetween(900, 1500)),
        temperature: round(randomBetween(38, 52)),
        humidity: round(randomBetween(75, 96)),
      };
    }
    case 'BROKEN_SENSOR':
      return {
        pm25: -25,
        pm10: 950,
        co2: 15000,
        temperature: 125,
        humidity: 145,
      };
    default: {
      const pm25 = round(randomBetween(4, 35));
      return {
        pm25,
        pm10: round(pm25 + randomBetween(6, 30)),
        co2: round(randomBetween(380, 750)),
        temperature: round(randomBetween(8, 34)),
        humidity: round(randomBetween(30, 85)),
      };
    }
  }
}

function calculateAqi(pm25: number, pm10: number) {
  const pm25Score = (pm25 / 35.4) * 100;
  const pm10Score = (pm10 / 154) * 100;
  return Math.min(500, Math.max(1, Math.round(Math.max(pm25Score, pm10Score))));
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
