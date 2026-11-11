import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeService', () => {
  let dir: string;
  const service = new KnowledgeService();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'knowledge-'));
    process.env.KNOWLEDGE_DIR = dir;
  });

  afterEach(() => {
    delete process.env.KNOWLEDGE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('preenche as variáveis do prompt', () => {
    writeFileSync(join(dir, 'prompt.md'), 'Curso {{CURSO}} por {{PRECO}}.');
    writeFileSync(
      join(dir, 'variables.json'),
      JSON.stringify({ CURSO: 'Exemplo', PRECO: 'R$ 10' }),
    );
    expect(service.getSystemPrompt()).toBe('Curso Exemplo por R$ 10.');
  });

  it('funciona sem variables.json e mantém placeholders sem valor', () => {
    writeFileSync(join(dir, 'prompt.md'), 'Link: {{LINK}}');
    expect(service.getSystemPrompt()).toBe('Link: {{LINK}}');
  });

  it('lê o arquivo de novo a cada chamada, sem precisar reiniciar', () => {
    writeFileSync(join(dir, 'prompt.md'), 'versão 1');
    expect(service.getSystemPrompt()).toBe('versão 1');
    writeFileSync(join(dir, 'prompt.md'), 'versão 2');
    expect(service.getSystemPrompt()).toBe('versão 2');
  });
});
