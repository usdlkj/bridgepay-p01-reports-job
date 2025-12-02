import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import moment from 'moment-timezone';
import { BaseReportService } from './base-report.service';

const TIMEZONE_WIB = 'Asia/Jakarta';

@Injectable()
export class FinanceReportService extends BaseReportService {
  constructor(
    @Inject('ProcessorToCoreClient') coreService: ClientProxy,
    configService: ConfigService,
    logger: Logger,
  ) {
    super(coreService, configService, logger);
  }
  
  async generate(params: { reportDate: string }) {
    try {
      const report = await super.getOrCreateReport('Finance Report', params.reportDate);

      const start = moment.tz(params.reportDate, TIMEZONE_WIB).startOf('day');
      const end = moment.tz(params.reportDate, TIMEZONE_WIB).endOf('day');

      const taskPayload = {
        startDate: start,
        endDate: end,
        reportType: 'Finance Report',
        reportId: report.id,
      };

      await this.generateFinanceReport(taskPayload);

    } catch (error) {
      super.logger.error(`Failed to generate finance report: ${error.message}`);
    }
  }

  async generateFinanceReport(params: any) {
    try {
      const start = moment(params.startDate).tz('Asia/Jakarta');
      const end = moment(params.endDate).tz('Asia/Jakarta');

      const orders = await super.fetchOrders(start, end);
      
      const data: string[] = [];

      const totals = {
        xendit: { gross: 0, fee: 0, tax: 0, other: 0, net: 0 },
        doku: { gross: 0, fee: 0, tax: 0, other: 0, net: 0 },
        finnet: { gross: 0, fee: 0, tax: 0, other: 0, net: 0 },
      };

      const agencyFee = start.isAfter(
        moment.tz('2023-10-17 00:00', TIMEZONE_WIB),
      )
        ? 5000
        : 0;

      for (const order of orders) {
        const amount = parseFloat(order.amount);
        const pgName = order.service?.paymentGateway?.pgName?.toLowerCase();
        const dataAmount = super.calculateTotalAmount(
          pgName,
          amount,
          order.service?.feeCalculation,
          agencyFee,
        );

        if (totals[pgName]) {
          totals[pgName].gross += dataAmount.grossAmount;
          totals[pgName].fee += dataAmount.serviceFee;
          totals[pgName].tax += dataAmount.ppn;
          totals[pgName].other += dataAmount.agencyFee;
          totals[pgName].net += dataAmount.netAmount;
        }
      }

      data.push(
        [
          totals.xendit.gross.toFixed(0),
          totals.xendit.fee.toFixed(0),
          totals.xendit.tax.toFixed(0),
          totals.xendit.other.toFixed(0),
          totals.xendit.net.toFixed(0),
          totals.doku.gross.toFixed(0),
          totals.doku.fee.toFixed(0),
          totals.doku.tax.toFixed(0),
          totals.doku.other.toFixed(0),
          totals.doku.net.toFixed(0),
          totals.finnet.gross.toFixed(0),
          totals.finnet.fee.toFixed(0),
          totals.finnet.tax.toFixed(0),
          totals.finnet.other.toFixed(0),
          totals.finnet.net.toFixed(0),
        ].join('||'),
      );

      await super.updateReportStatus(params.reportId, data);
    } catch (error) {
      super.logger.error(`Failed to generate finance report: ${error.message}`);
    }
  }
}
