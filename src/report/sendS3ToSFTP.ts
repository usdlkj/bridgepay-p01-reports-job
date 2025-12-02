import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as path from 'path';
import Client from 'ssh2-sftp-client';
import { ConfigService } from '@nestjs/config';

export async function sendS3ToSFTP(
  configService: ConfigService,
  params: {
  s3Key: string;
  sftpDestPath: string;
  fallbackLocalPath: string; // e.g. './reports/MW_20250714.txt'
  },
): Promise<void> {
  const env = configService.get<string>('nodeEnv');
  const { s3Key, sftpDestPath, fallbackLocalPath } = params;

  const ftpHost = configService.get<string>('ftpHost', 'localhost');
  const ftpPort = parseInt(configService.get<string>('ftpPort') || '22', 10);
  const ftpUsername = configService.get<string>('ftpUsername', '');
  const ftpPassword = configService.get<string>('ftpPassword', '');

  if (env === 'development' || env === 'test') {
    // fallback: copy from local
    try {
      const fallbackDir = path.dirname(fallbackLocalPath);
      await fs.mkdir(fallbackDir, { recursive: true });
      await fs.copyFile(
        fallbackLocalPath,
        `/tmp/${path.basename(fallbackLocalPath)}`,
      );

      const sftp = new Client();
      await sftp.connect({
        host: ftpHost,
        port: ftpPort,
        username: ftpUsername,
        password: ftpPassword,
      });

      await sftp.put(`/tmp/${path.basename(fallbackLocalPath)}`, sftpDestPath, {
        writeStreamOptions: { flags: 'w', encoding: null, mode: 0o755 },
      });

      await sftp.end();
    } catch (err) {
      console.error(`SFTP fallback upload failed: ${err.message}`);
    }
    return;
  }

  const s3Client = new S3Client({
    region: configService.get<string>('aws.region'),
    credentials: {
      accessKeyId: configService.get<string>('aws.accessKey') || '',
      secretAccessKey: configService.get<string>('aws.secretKey') || '',
    },
  });

  // Normal S3 streaming upload in staging/production
  const s3Stream = await getS3FileStream(
    s3Client,
    configService.get<string>('aws.s3Bucket') || '',
    s3Key,
  );

  const sftp = new Client();
  try {
    await sftp.connect({
      host: ftpHost,
      port: ftpPort,
      username: ftpUsername,
      password: ftpPassword,
    });

    await sftp.put(s3Stream, sftpDestPath, {
      writeStreamOptions: { flags: 'w', encoding: null, mode: 0o755 },
    });
  } finally {
    await sftp.end();
  }
}

async function getS3FileStream(
  s3Client: S3Client,
  bucket: string,
  s3Key: string,
): Promise<Readable> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  return response.Body as Readable;
}
