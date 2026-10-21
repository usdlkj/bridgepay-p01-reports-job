import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export async function uploadReportToS3(
  configService: ConfigService,
  key: string,
  content: string,
): Promise<void> {
  const bucket = configService.get<string>('aws.s3Bucket');
  const region = configService.get<string>('aws.region');
  if (!bucket || !region) {
    throw new Error(
      'AWS_S3_BUCKET and AWS_REGION must be set to deliver reports',
    );
  }
  // Credentials come from the default chain (IRSA in the cluster).
  const client = new S3Client({ region });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: 'text/plain; charset=utf-8',
      ServerSideEncryption: 'AES256',
    }),
  );
}
