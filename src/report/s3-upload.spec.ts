import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { uploadReportToS3 } from './s3-upload';

jest.mock('@aws-sdk/client-s3');

const config = (values: Record<string, string>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;

describe('uploadReportToS3', () => {
  const send = jest.fn();
  beforeEach(() => {
    send.mockReset().mockResolvedValue({});
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));
    (PutObjectCommand as unknown as jest.Mock).mockClear();
  });

  it('refuses to run without a bucket or region', async () => {
    await expect(
      uploadReportToS3(config({ 'aws.region': 'ap-southeast-3' }), 'k', 'c'),
    ).rejects.toThrow('AWS_S3_BUCKET and AWS_REGION');
    await expect(
      uploadReportToS3(config({ 'aws.s3Bucket': 'b' }), 'k', 'c'),
    ).rejects.toThrow('AWS_S3_BUCKET and AWS_REGION');
    expect(send).not.toHaveBeenCalled();
  });

  it('puts the object encrypted, without static credentials', async () => {
    await uploadReportToS3(
      config({
        'aws.region': 'ap-southeast-3',
        'aws.s3Bucket': 'reports-bucket',
      }),
      'reports/MW_20261020.txt',
      'row1\nrow2',
    );
    expect(S3Client).toHaveBeenCalledWith({ region: 'ap-southeast-3' });
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'reports-bucket',
        Key: 'reports/MW_20261020.txt',
        Body: 'row1\nrow2',
        ServerSideEncryption: 'AES256',
      }),
    );
  });

  it('propagates an S3 failure', async () => {
    send.mockRejectedValue(new Error('AccessDenied'));
    await expect(
      uploadReportToS3(
        config({ 'aws.region': 'ap-southeast-3', 'aws.s3Bucket': 'b' }),
        'k',
        'c',
      ),
    ).rejects.toThrow('AccessDenied');
  });
});
