import { Module } from '@nestjs/common';
import { BrokerModule } from 'src/broker/broker.module';
import { ReportController } from './report.controller';
import { BaseReportService } from './base-report.service';
import { OrderReportService } from './order-report.service';
import { FinanceReportService } from './finance-report.service';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    BrokerModule, 
    LoggerModule,
  ],
  providers: [
    BaseReportService, 
    OrderReportService,
    FinanceReportService,
  ],
  controllers: [ReportController],
})
export class ReportModule {}
