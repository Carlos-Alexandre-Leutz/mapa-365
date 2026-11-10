import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Query,
} from '@nestjs/common';

@Controller('webhooks/whatsapp')
export class WhatsappController {
  @Get()
  @Header('content-type', 'text/plain')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return challenge;
    }
    throw new ForbiddenException();
  }
}
