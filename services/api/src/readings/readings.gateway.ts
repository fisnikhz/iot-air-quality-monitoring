import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AirQualityReadingModel } from './models/air-quality-reading.model';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class ReadingsGateway {
  @WebSocketServer()
  private server!: Server;

  emitReading(reading: AirQualityReadingModel) {
    this.server.emit('reading.created', reading);
  }

  @SubscribeMessage('reading.subscribe')
  subscribeToDevice(@MessageBody() deviceId: string) {
    return {
      event: 'reading.subscribed',
      data: { deviceId },
    };
  }
}
