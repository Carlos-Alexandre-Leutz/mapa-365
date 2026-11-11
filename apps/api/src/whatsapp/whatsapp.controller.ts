import {
  Body,
  Controller,
  Logger,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MetaSignatureGuard } from './meta-signature.guard';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

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

  @Post()
  @HttpCode(200)
  @UseGuards(MetaSignatureGuard)
  receive(@Body() payload: unknown): string {
    // Responde 200 na hora; a Meta reenvia se a resposta demorar.
    this.whatsapp.process(payload).catch((error: Error) => {
      this.logger.error(`Falha no processamento em segundo plano: ${error.message}`);
    });
    return 'EVENT_RECEIVED';
  }
}
