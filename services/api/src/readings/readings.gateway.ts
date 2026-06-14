import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AirQualityReadingModel } from './models/air-quality-reading.model';

@WebSocketGateway({
  cors: {
    origin: allowSocketOrigin,
    credentials: true,
  },
  transports: ['polling', 'websocket'],
})
export class ReadingsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ReadingsGateway.name);

  @WebSocketServer()
  private server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Live client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Live client disconnected: ${client.id}`);
  }

  emitReading(reading: AirQualityReadingModel) {
    if (!this.server) {
      return;
    }

    this.server.emit('reading.created', reading);
    this.server
      .to(`device:${reading.deviceId}`)
      .emit('reading.device', reading);
  }

  emitAlert(alert: {
    deviceId: string;
    locationId: string;
    timestamp: Date;
    alertLevel: string;
    message: string;
  }) {
    if (!this.server) {
      return;
    }

    this.server.emit('alert.created', alert);
  }

  @SubscribeMessage('reading.subscribe')
  async subscribeToDevice(
    @ConnectedSocket() client: Socket,
    @MessageBody() deviceId: string,
  ) {
    await client.join(`device:${deviceId}`);

    return {
      event: 'reading.subscribed',
      data: { deviceId },
    };
  }
}

function allowSocketOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
    origin,
  );

  if (isLocalOrigin || configuredOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Socket origin is not allowed: ${origin}`), false);
}
