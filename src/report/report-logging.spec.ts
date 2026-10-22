import { of, throwError } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { OrderReportService } from './order-report.service';
import { FinanceReportService } from './finance-report.service';

// Regression: these services logged through `super.logger`, which is undefined at runtime,
// so a completed-report skip or any generate error crashed with a TypeError instead.
const config = { get: (_k: string, d?: string) => d } as unknown as ConfigService;
const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe.each([
  ['OrderReportService', OrderReportService],
  ['FinanceReportService', FinanceReportService],
])('%s logging', (_name, Service) => {
  beforeEach(() => jest.clearAllMocks());

  it('skips a completed report without crashing', async () => {
    const core = { send: jest.fn(() => of({ id: 1, status: 'Completed' })) };
    const svc = new Service(core as never, config, logger as never);
    await expect(svc.generate({ reportDate: '2026-10-21' })).resolves.toBeUndefined();
    expect(logger.log).toHaveBeenCalled();
  });

  it('logs and rethrows the original error', async () => {
    const boom = new Error('core down');
    const core = { send: jest.fn(() => throwError(() => boom)) };
    const svc = new Service(core as never, config, logger as never);
    await expect(svc.generate({ reportDate: '2026-10-21' })).rejects.toBe(boom);
    expect(logger.error).toHaveBeenCalled();
  });
});
