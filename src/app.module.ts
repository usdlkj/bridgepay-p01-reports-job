import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from 'nestjs-pino';
import { ReportModule } from './report/report.module';
import { ConfigModule } from '@nestjs/config';
import { BrokerModule } from './broker/broker.module';
import appConfig from './config/app.config';
import rabbitmqConfig from './config/rabbitmq.config';
import awsConfig from './config/aws.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, awsConfig, rabbitmqConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport: {
          target: 'pino-pretty',
        },
      },
    }),
    ReportModule,
    BrokerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [LoggerModule],
})
export class AppModule {}
