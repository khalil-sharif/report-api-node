import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const mail = this.config.get('mail') as {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      password?: string;
      from: string;
    };
    this.from = mail.from;
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
    });
  }

  async send(params: {
    to: string[];
    subject: string;
    html: string;
    attachments?: MailAttachment[];
  }): Promise<void> {
    if (!params.to.length) {
      this.logger.warn('send() called with no recipients; skipping.');
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: params.to.join(', '),
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });
    this.logger.log(`Sent "${params.subject}" to ${params.to.length} recipient(s).`);
  }
}
