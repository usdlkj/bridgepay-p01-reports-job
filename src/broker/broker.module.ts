import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.registerAsync([
      {
        name: 'ProcessorToCoreClient',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const caPath = config.get<string>('rabbitmq.caPath');
          const ca = caPath ? readFileSync(caPath) : undefined;
          const url =
            config.get<string>('rabbitmq.url') || 'amqps://localhost:5672';
          const queue =
            config.get<string>('rabbitmq.coreQueue') || 'bridgepay-core';

          return {
            transport: Transport.RMQ,
            options: {
              urls: [url],
              queue,
              queueOptions: { durable: true },
              socketOptions: ca ? { ca: [ca] } : undefined,
            },
          };
        },
      },
      {
        name: 'ProcessorToGatewayClient',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const caPath = config.get<string>('rabbitmq.caPath');
          const ca = caPath ? readFileSync(caPath) : undefined;
          const url =
            config.get<string>('rabbitmq.url') || 'amqps://localhost:5672';
          const queue =
            config.get<string>('rabbitmq.gatewayQueue') || 'bridgepay-gateway';

          return {
            transport: Transport.RMQ,
            options: {
              urls: [url],
              queue,
              queueOptions: { durable: true },
              socketOptions: ca ? { ca: [ca] } : undefined,
            },
          };
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class BrokerModule {}
