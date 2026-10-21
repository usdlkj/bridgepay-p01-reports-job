import { ConfigService } from '@nestjs/config';
import { BaseReportService } from './base-report.service';
import { uploadReportToS3 } from './s3-upload';
import * as fs from 'fs/promises';

jest.mock('./s3-upload');
jest.mock('fs/promises');

class Probe extends BaseReportService {
  write(args: { filePath: string; fileName: string; content: string }) {
    return this.writeReportFile(args);
  }
  force() {
    return this.forceRegeneration();
  }
}

const build = (values: Record<string, string>) => {
  const config = {
    get: (k: string, d?: string) => values[k] ?? d,
  } as unknown as ConfigService;
  return { probe: new Probe({} as never, config, {} as never), config };
};
const file = {
  filePath: './reports/MW_1.txt',
  fileName: 'MW_1.txt',
  content: 'x',
};

describe('BaseReportService delivery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the environment from config (it used to stay undefined)', async () => {
    const { probe } = build({ nodeEnv: 'test' });
    await probe.write(file);
    expect(fs.writeFile).toHaveBeenCalledWith('./reports/MW_1.txt', 'x');
    expect(uploadReportToS3).not.toHaveBeenCalled();
  });

  it('uploads to S3 outside development and test', async () => {
    const { probe, config } = build({ nodeEnv: 'production' });
    await probe.write(file);
    expect(uploadReportToS3).toHaveBeenCalledWith(
      config,
      'reports/MW_1.txt',
      'x',
    );
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('lets an upload failure propagate so the report is not marked Completed', async () => {
    (uploadReportToS3 as jest.Mock).mockRejectedValue(
      new Error('AccessDenied'),
    );
    const { probe } = build({ nodeEnv: 'production' });
    await expect(probe.write(file)).rejects.toThrow('AccessDenied');
  });

  it('only forces regeneration when REPORT_FORCE is yes', () => {
    expect(build({ reportForce: 'yes' }).probe.force()).toBe(true);
    expect(build({ reportForce: 'YES' }).probe.force()).toBe(true);
    expect(build({}).probe.force()).toBe(false);
    expect(build({ reportForce: 'no' }).probe.force()).toBe(false);
  });
});
