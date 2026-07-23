import { Global, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';

/** Aggregates the globally-available infrastructure providers. */
@Global()
@Module({
  imports: [PrismaModule, RedisModule, StorageModule, MailModule],
  exports: [PrismaModule, RedisModule, StorageModule, MailModule],
})
export class CommonModule {}
