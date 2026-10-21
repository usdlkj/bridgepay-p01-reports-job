import { uploadReportToS3 } from './s3-upload';
import { Inject, Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import * as moment from 'moment-timezone';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClientProxy } from '@nestjs/microservices';

const TIMEZONE_WIB = 'Asia/Jakarta';

export interface ReportEntity {
  id: string;
  reportType: string;
  reportDate: string;
  status?: string;
}

export interface ReportLookup {
  report: ReportEntity;
  existed: boolean;
}

export interface OrderReportAmount {
  grossAmount: number;
  serviceFee: number;
  netAmount: number;
  agencyFee: number;
  ppn?: number;
}

@Injectable()
export class BaseReportService {
  protected readonly env: string;

  constructor(
    @Inject('ProcessorToCoreClient')
    protected readonly coreService: ClientProxy,
    protected readonly configService: ConfigService,
    protected readonly logger: Logger,
  ) {
    this.env = this.configService.get<string>('nodeEnv', 'development');
  }

  /** REPORT_FORCE=yes regenerates reports Core already marks Completed (backfill). */
  protected forceRegeneration(): boolean {
    return (
      this.configService.get<string>('reportForce', 'no').toLowerCase() ===
      'yes'
    );
  }

  /**
   * Shared util for fetching existing report or creating a new one.
   */
  protected async getOrCreateReport(
    reportType: string,
    reportDate: string,
  ): Promise<ReportLookup> {
    const existing = await firstValueFrom(
      this.coreService.send(
        { cmd: 'get-report-data' },
        { reportType, reportDate },
      ),
    );

    if (existing) {
      return { report: existing as ReportEntity, existed: true };
    }

    const created = await firstValueFrom(
      this.coreService.send(
        { cmd: 'save-report-data' },
        { reportType, reportDate },
      ),
    );

    return { report: created as ReportEntity, existed: false };
  }

  /**
   * Shared util for fetching orders within a date range.
   */
  protected async fetchOrders(
    start: moment.Moment,
    end: moment.Moment,
  ): Promise<any[]> {
    const orders = await firstValueFrom(
      this.coreService.send(
        { cmd: 'get-order-report' },
        {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      ),
    );

    return (orders || []) as any[];
  }

  /**
   * Safe JSON parser with fallback.
   */
  protected safeParseJson<T>(value: string | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.warn(
        `Failed to parse JSON, returning fallback. Raw length=${value.length}`,
      );
      return fallback;
    }
  }

  /**
   * Shared util for updating report status in DB.
   */
  protected async updateReportStatus(reportId: string, rows: any[]) {
    await firstValueFrom(
      this.coreService.send(
        { cmd: 'update-report-data' },
        {
          id: reportId,
          data: {
            reportData: JSON.stringify(rows),
            status: 'Completed',
          },
        },
      ),
    );
  }

  /**
   * Shared file writer (local for dev/test, S3 for prod).
   */
  protected async writeReportFile(args: {
    filePath: string;
    fileName: string;
    content: string;
  }) {
    const { filePath, fileName, content } = args;

    const shouldWriteLocal = this.env === 'development' || this.env === 'test';

    if (shouldWriteLocal) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
      return;
    }

    // A failed upload throws, so the report is not marked Completed and the job fails.
    await uploadReportToS3(this.configService, `reports/${fileName}`, content);
  }

  /**
   * Shared fee calculation logic (equivalent to original JS version).
   */
  protected calculateTotalAmount(
    pgName: string,
    amount: number,
    feeCalculation: any,
    extraFee: number,
  ): OrderReportAmount {
    const feeDetail =
      typeof feeCalculation === 'string'
        ? JSON.parse(feeCalculation)
        : feeCalculation || {};

    const percentFee =
      feeDetail.percentage && feeDetail.percentage !== 0
        ? Math.round((amount * feeDetail.percentage) / 100)
        : 0;

    const fixedFee = feeDetail.fixed || 0;

    const totalFee = percentFee + fixedFee;

    const type = feeDetail.type
      ? String(feeDetail.type).toLowerCase()
      : 'inclusive';

    const grossAmount =
      type === 'inclusive' ? amount + extraFee : amount + extraFee + totalFee;

    const isXendit = (pgName || '').toLowerCase() === 'xendit';
    const PPN_VALUE = parseInt(process.env.PPN_VALUE || '11', 10);

    const ppn = isXendit ? Math.round((totalFee * PPN_VALUE) / 100) : 0;

    let netAmount = grossAmount - totalFee - extraFee - ppn;
    if (netAmount < 0) netAmount = 0;

    return {
      serviceFee: totalFee,
      grossAmount,
      netAmount,
      agencyFee: extraFee,
      ppn,
    };
  }
}
