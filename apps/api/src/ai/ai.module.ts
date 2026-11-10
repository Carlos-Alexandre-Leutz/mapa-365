import { Module } from '@nestjs/common';
import { GeminiClient } from './gemini.client';
import { KnowledgeService } from './knowledge.service';

@Module({
  providers: [GeminiClient, KnowledgeService],
  exports: [GeminiClient, KnowledgeService],
})
export class AiModule {}
