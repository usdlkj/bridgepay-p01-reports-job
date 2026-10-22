import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { OrderReportService } from './order-report.service';
import { FinanceReportService } from './finance-report.service';

// Regression: `super.logger` was undefined at runtime, and OrderReportService injected a
// pino logger (no `log()`) instead of the nestjs-pino Logger the base class expects, so a
// completed-report skip or any generate error crashed with a TypeError. Real DI is used
// on purpose: a mock logger hid the second bug.
const build = async (send: jest.Mock) => {
  const moduleRef = await Test.createTestingModule({
    imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
    providers: [
      OrderReportService,
      FinanceReportService,
      { provide: 'ProcessorToCoreClient', useValue: { send } },
      { provide: ConfigService, useValue: { get: (_k: string, d?: string) => d } },
    ],
  }).compile();
  return {
    order: moduleRef.get(OrderReportService),
    finance: moduleRef.get(FinanceReportService),
  };
};

describe.each(['order', 'finance'] as const)('%s report logging', (which) => {
  it('skips a completed report without crashing', async () => {
    const svc = (await build(jest.fn(() => of({ id: 1, status: 'Completed' }))))[which];
    await expect(svc.generate({ reportDate: '2026-10-21' })).resolves.toBeUndefined();
  });

  it('rethrows the original error', async () => {
    const boom = new Error('core down');
    const svc = (await build(jest.fn(() => throwError(() => boom))))[which];
    await expect(svc.generate({ reportDate: '2026-10-21' })).rejects.toBe(boom);
  });
});
