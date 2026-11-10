import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [UsersModule, AuthModule, PrismaModule, ChatModule, WhatsappModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
