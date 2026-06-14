import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { AppModule } from './app.module';
import { Device, DeviceDocument, DeviceStatus } from './devices/device.schema';
import { DevicesService } from './devices/devices.service';
import { Location, LocationDocument } from './locations/location.schema';
import { User, UserDocument } from './users/user.schema';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const locationModel = app.get<Model<LocationDocument>>(
      getModelToken(Location.name),
    );
    const deviceModel = app.get<Model<DeviceDocument>>(
      getModelToken(Device.name),
    );
    const devicesService = app.get(DevicesService);

    const email = process.env.DEMO_EMAIL ?? 'fisnik@example.com';
    const password = process.env.DEMO_PASSWORD ?? 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    await userModel.findOneAndUpdate(
      { email },
      {
        name: 'IoT Project Operator',
        email,
        passwordHash,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const stations = [
      {
        name: 'Prishtina Campus Station',
        description: 'Outdoor air-quality station at the FIEK campus',
        latitude: 42.6629,
        longitude: 21.1655,
        address: 'Bregu i Diellit',
        city: 'Prishtina',
        country: 'Kosovo',
      },
      {
        name: 'Prishtina City Center',
        description: 'Urban traffic monitoring station',
        latitude: 42.6622,
        longitude: 21.1575,
        address: 'Mother Teresa Square',
        city: 'Prishtina',
        country: 'Kosovo',
      },
      {
        name: 'Germia Park Station',
        description: 'Green-area reference monitoring station',
        latitude: 42.6795,
        longitude: 21.1958,
        address: 'Germia Regional Park',
        city: 'Prishtina',
        country: 'Kosovo',
      },
    ];
    const sensorDefinitions = [
      { externalId: 'AQ-PR-001', name: 'Campus Outdoor Sensor' },
      { externalId: 'AQ-PR-002', name: 'City Traffic Sensor' },
      { externalId: 'AQ-PR-003', name: 'Park Reference Sensor' },
    ];

    for (const [index, station] of stations.entries()) {
      const location = await locationModel.findOneAndUpdate(
        { name: station.name },
        station,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const sensor = sensorDefinitions[index];
      const existingDevice = await deviceModel
        .findOne({ externalId: sensor.externalId })
        .exec();

      if (existingDevice) {
        await devicesService.update({
          id: String(existingDevice._id),
          name: sensor.name,
          locationId: String(location._id),
          status: DeviceStatus.ACTIVE,
        });
      } else {
        await devicesService.create({
          name: sensor.name,
          externalId: sensor.externalId,
          locationId: String(location._id),
          status: DeviceStatus.ACTIVE,
          installedAt: new Date(),
        });
      }
    }

    console.log('Demo data is ready.');
    console.log(`Login: ${email} / ${password}`);
  } finally {
    await app.close();
  }
}

void seed();
