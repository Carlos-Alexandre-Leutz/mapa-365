import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class MetaSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = process.env.WHATSAPP_APP_SECRET;
    const header: string | undefined = request.headers['x-hub-signature-256'];
    const rawBody: Buffer | undefined = request.rawBody;

    if (!secret || !header || !rawBody) {
      throw new UnauthorizedException();
    }

    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const received = Buffer.from(header);
    const wanted = Buffer.from(expected);

    if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
