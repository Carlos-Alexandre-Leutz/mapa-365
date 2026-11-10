import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  getSystemPrompt(): string {
    const dir = this.resolveDir();
    const template = readFileSync(join(dir, 'prompt.md'), 'utf8');
    return this.fill(template, this.readVariables(dir));
  }

  private resolveDir(): string {
    const configured = process.env.KNOWLEDGE_DIR;
    if (configured) {
      return configured;
    }
    const real = join(process.cwd(), 'knowledge');
    if (existsSync(join(real, 'prompt.md'))) {
      return real;
    }
    this.logger.warn(
      'knowledge/ não encontrada; usando knowledge.example (dados fictícios)',
    );
    return join(process.cwd(), 'knowledge.example');
  }

  private readVariables(dir: string): Record<string, string> {
    const file = join(dir, 'variables.json');
    if (!existsSync(file)) {
      return {};
    }
    return JSON.parse(readFileSync(file, 'utf8'));
  }

  private fill(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
      if (key in variables) {
        return String(variables[key]);
      }
      this.logger.warn(`Variável ${placeholder} sem valor em variables.json`);
      return placeholder;
    });
  }
}
