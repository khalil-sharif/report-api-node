import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

/**
 * Object storage over MinIO (S3 compatible). Stores generated report files and
 * hands out presigned download URLs so binaries never stream through the API.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly presignExpiry: number;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const m = this.config.get('minio') as {
      endPoint: string;
      port: number;
      useSSL: boolean;
      accessKey: string;
      secretKey: string;
      bucket: string;
      presignExpiry: number;
    };
    this.bucket = m.bucket;
    this.presignExpiry = m.presignExpiry;
    this.client = new MinioClient({
      endPoint: m.endPoint,
      port: m.port,
      useSSL: m.useSSL,
      accessKey: m.accessKey,
      secretKey: m.secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created bucket "${this.bucket}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not ensure bucket "${this.bucket}": ${(err as Error).message}. ` +
          'Storage calls will fail until MinIO is reachable.',
      );
    }
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<number> {
    await this.client.putObject(this.bucket, objectKey, body, body.length, {
      'Content-Type': contentType,
    });
    return body.length;
  }

  async putStream(objectKey: string, stream: Readable, contentType: string): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, stream, undefined, {
      'Content-Type': contentType,
    });
  }

  async getBuffer(objectKey: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  /** Time-limited direct download URL (defaults to configured expiry). */
  async presignedUrl(objectKey: string, expirySeconds?: number): Promise<string> {
    return this.client.presignedGetObject(
      this.bucket,
      objectKey,
      expirySeconds ?? this.presignExpiry,
    );
  }

  async remove(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }
}
