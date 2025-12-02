interface PgResponseRecord {
  responseCode: string;
  responseData: string; // JSON string
  bank_reconciliation_id?: string;
}

interface PaymentGatewayInfo {
  pgName?: string;
}

interface PaymentTypeInfo {
  paymentTypeName?: string;
}

interface PaymentProviderInfo {
  paymentProviderName?: string;
}

interface OrderServiceInfo {
  paymentGateway?: PaymentGatewayInfo;
  paymentType?: PaymentTypeInfo;
  paymentProvider?: PaymentProviderInfo;
  feeCalculation?: any;
}

interface OrderRecord {
  id: string;
  amount: string;
  invoiceNumber: string;
  invoiceData: string; // JSON string
  createdAtReconciliation: string;
  pgResponse: PgResponseRecord[];
  service?: OrderServiceInfo;
}

interface ReportEntity {
  id: string;
  reportType: string;
  reportDate: string;
  status?: string;
}

interface OrderReportAmount {
  grossAmount: number;
  serviceFee: number;
  netAmount: number;
  agencyFee: number;
  ppn?: number;
}
import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ClientProxy } from '@nestjs/microservices';
import { sendS3ToSFTP } from './sendS3ToSFTP';
import { ConfigService } from '@nestjs/config';
import * as appConfig from '../config/app.config';
import moment from 'moment-timezone';
import { BaseReportService } from './base-report.service';
const appEnv = appConfig.default();

const TIMEZONE_WIB = 'Asia/Jakarta';
const SEND_FTP = appEnv.sendFtp?.toLowerCase() === 'yes';
const REPORT_PATH = appEnv.reportPath || './reports';

@Injectable()
export class OrderReportService extends BaseReportService {
  constructor(
    @Inject('ProcessorToCoreClient') coreService: ClientProxy,
    configService: ConfigService,
    logger: Logger,
  ) {
    super(coreService, configService, logger);
  }
  
  async generate(params: { reportDate: string }) {
    try {
      const start = moment.tz(params.reportDate, TIMEZONE_WIB).startOf('day');
      const end = moment.tz(params.reportDate, TIMEZONE_WIB).endOf('day');

      const report = await super.getOrCreateReport('Order Report', params.reportDate);
      
      const taskPayload = {
        startDate: start,
        endDate: end,
        reportType: 'Order Report',
        reportId: report.id,
        sendFTP: SEND_FTP ? 'yes' : 'no',
      };

      await this.generateOrderReport(taskPayload);
    } catch (error: any) {
      super.logger.error(`Failed to generate order report: ${error.message}`, { err: error });
    }
  }

  async generateOrderReport(params: any) {
    try {
      const start = moment(params.startDate).tz(TIMEZONE_WIB);
      const end = moment(params.endDate).tz(TIMEZONE_WIB);

      const orders: OrderRecord[] = await super.fetchOrders(start, end);

      let orderCount = 0;
      let transactionTotal = 0;
      let serviceFeeTotal = 0;
      let settlementTotal = 0;
      let agencyFeeTotal = 0;

      const rows: string[] = [];

      for (const order of orders) {
        orderCount++;

        const invoiceData = super.safeParseJson(order.invoiceData, {});
        const pgResponse = (order.pgResponse || [])[0] as PgResponseRecord | undefined;
        if (!pgResponse) {
          super.logger.warn(`Missing pgResponse for order ${order.id}`);
          continue;
        }

        const responseData = super.safeParseJson(pgResponse.responseData, {});

        const pgName = order.service?.paymentGateway?.pgName || '';

        const dataAmount: OrderReportAmount = super.calculateTotalAmount(
          pgName,
          parseFloat(order.amount),
          order.service?.feeCalculation,
          0,
        );

        serviceFeeTotal += dataAmount.serviceFee;
        transactionTotal += dataAmount.grossAmount;
        settlementTotal += dataAmount.netAmount;
        agencyFeeTotal += dataAmount.agencyFee;

        const pgId = this.extractPgId(pgName, pgResponse, responseData);

        const row = this.formatOrderRow({
          order,
          invoiceData,
          responseData,
          pgName,
          pgId,
          dataAmount,
        });

        rows.push(row);
      }

      const summaryRow = this.buildSummaryRow({
        orderCount,
        transactionTotal,
        serviceFeeTotal,
        settlementTotal,
        agencyFeeTotal,
      });
      rows.push(summaryRow);

      const reportTitle = `MW_${start.format('YYYYMMDD')}`;
      const fileName = `${reportTitle}.txt`;
      const filePath = `${REPORT_PATH}/${fileName}`;
      const content = rows.join('\n');

      await super.writeReportFile({ filePath, fileName, content });

      if ((params.sendFTP || '').toLowerCase() === 'yes') {
        await sendS3ToSFTP(this.configService, {
          s3Key: `reports/${fileName}`,
          sftpDestPath: `${this.configService.get('ftpPath')}/${reportTitle}.txt`,
          fallbackLocalPath: filePath,
        });
      }

      await super.updateReportStatus(params.reportId, rows);
    } catch (error: any) {
      super.logger.error(`Failed to generate order report: ${error.message}`, { err: error });
    }
  }

  private extractPgId(pgNameRaw: string, pgResponse: PgResponseRecord, responseData: any): string {
    const pgName = (pgNameRaw || '').toLowerCase();

    if (pgName === 'xendit') {
      if (pgResponse.responseCode === 'CCPaid') {
        return pgResponse.bank_reconciliation_id || '';
      }
      if (pgResponse.responseCode === 'VAPaid') {
        return responseData?.payment_id || '';
      }
      if (pgResponse.responseCode === 'QRPaid') {
        return responseData?.data?.id || '';
      }
      return responseData?.id || '';
    }

    if (pgName === 'finnet') {
      return responseData?.ref_no || '';
    }

    if (pgName === 'doku') {
      if (pgResponse.responseCode === 'VAPaid') {
        const acquirerId = responseData?.acquirer?.id;
        if (acquirerId === 'BANK_DANAMON') {
          return responseData?.transaction?.original_request_id || '';
        }
        if (acquirerId === 'BNI') {
          const identifier = responseData?.virtual_account_payment?.identifier || [];
          const trx = identifier.find((item: any) => item?.name === 'TRX_ID');
          return trx?.value || '';
        }
        return responseData?.virtual_account_payment?.reference_number || '';
      }
      return responseData?.emoney_payment?.approval_code || '';
    }

    return '';
  }

  private formatOrderRow(args: {
    order: OrderRecord;
    invoiceData: any;
    responseData: any;
    pgName: string;
    pgId: string;
    dataAmount: OrderReportAmount;
  }): string {
    const { order, invoiceData, responseData, pgName, pgId, dataAmount } = args;

    const txnTimestamp = responseData?.transaction_timestamp || responseData?.created;
    const formattedTxnTime = txnTimestamp
      ? moment.utc(txnTimestamp).tz(TIMEZONE_WIB).format('YYYYMMDDHHmmss')
      : '';

    const requestBilling = invoiceData.reqData?.billing || {};

    const row = [
      order.invoiceNumber,
      order.id,
      pgId || '',
      order.createdAtReconciliation,
      formattedTxnTime,
      360,
      dataAmount.serviceFee,
      dataAmount.grossAmount,
      dataAmount.netAmount,
      pgName,
      order.service?.paymentType?.paymentTypeName,
      invoiceData.reqData?.payChannel,
      invoiceData.reqData?.ticketOffice,
      '01',
      order.service?.paymentProvider?.paymentProviderName,
      formattedTxnTime,
      'KCIC',
      responseData?.merchant_id || responseData?.owner_id || '',
      0,
      requestBilling?.customerId,
      requestBilling?.name,
      0,
      dataAmount.ppn || 0,
    ];

    return row.join('||');
  }

  private buildSummaryRow(args: {
    orderCount: number;
    transactionTotal: number;
    serviceFeeTotal: number;
    settlementTotal: number;
    agencyFeeTotal: number;
  }): string {
    const { orderCount, transactionTotal, serviceFeeTotal, settlementTotal, agencyFeeTotal } = args;

    const summaryArr = [
      orderCount,
      transactionTotal.toFixed(0),
      serviceFeeTotal.toFixed(0),
      settlementTotal.toFixed(0),
      agencyFeeTotal.toFixed(0),
    ];

    return summaryArr.join('||');
  }
}
