import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OrderReportService } from './order-report.service';
import { FinanceReportService } from './finance-report.service';
import moment from 'moment-timezone';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const logger = app.get(Logger);

  const orderReportService = app.get(OrderReportService);
  const financeReportService = app.get(FinanceReportService);

  // At 02:00 WIB, generate the previous calendar day unless a recovery run
  // explicitly supplies REPORT_DATE (YYYY-MM-DD).
  const configuredReportDate = process.env.REPORT_DATE;
  if (
    configuredReportDate &&
    !moment(configuredReportDate, 'YYYY-MM-DD', true).isValid()
  ) {
    throw new Error('REPORT_DATE must use YYYY-MM-DD format');
  }
  const targetDate =
    configuredReportDate ??
    moment().tz('Asia/Jakarta').subtract(1, 'day').format('YYYY-MM-DD');
  logger.log(`Running daily report for ${targetDate}...`);

  logger.log('Step 1: Generating Order Report...');
  await orderReportService.generate({ reportDate: targetDate });

  logger.log('Step 2: Generating Finance Report...');
  await financeReportService.generate({ reportDate: targetDate });

  logger.log('Daily report generation completed.');

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  // Since logger is not available here directly, create a temporary logger instance
  console.error('Report runner failed:', err);
  process.exit(1);
});
