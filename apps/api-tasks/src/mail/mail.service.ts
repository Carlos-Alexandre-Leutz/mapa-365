import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendPasswordReset(email: string, token: string) {

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Recuperação de Senha',
      html: `
        <h1>Recuperação de Senha</h1>
        <p>Você solicitou a alteração de senha. Clique no link abaixo para cadastrar uma nova senha:</p>
        <p><a href="${resetUrl}" target="_blank">Resetar minha senha</a></p>
        <br />
        <p>Se você não solicitou essa alteração, ignore este e-mail.</p>
        <p>O link expira em 1 hora.</p>
      `,
    });
  }
}