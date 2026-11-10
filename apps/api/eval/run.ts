/**
 * Avaliação das respostas da IA com a base de conhecimento real (ou a de exemplo).
 * Chama o Gemini de verdade, então precisa de GEMINI_API_KEY e gasta tokens.
 *
 *   pnpm --filter @mapa365/api eval
 *
 * Sai com código 1 se algum caso falhar, para comparar antes e depois de mexer no prompt.
 */
import { GeminiClient } from '../src/ai/gemini.client';
import { KnowledgeService } from '../src/ai/knowledge.service';
import { cases, EvalCase } from './cases';

function check(testCase: EvalCase, answer: string): string[] {
  const problems: string[] = [];
  for (const pattern of testCase.mustMatch ?? []) {
    if (!pattern.test(answer)) problems.push(`deveria casar ${pattern}`);
  }
  for (const pattern of testCase.mustNotMatch ?? []) {
    if (pattern.test(answer)) problems.push(`não deveria casar ${pattern}`);
  }
  if (testCase.maxLength && answer.length > testCase.maxLength) {
    problems.push(`resposta com ${answer.length} caracteres (máx. ${testCase.maxLength})`);
  }
  return problems;
}

async function main() {
  const prompt = new KnowledgeService().getSystemPrompt();
  const gemini = new GeminiClient();
  let failed = 0;

  for (const testCase of cases) {
    const history = testCase.messages.map((text) => ({ role: 'user' as const, text }));
    let answer: string;
    try {
      answer = await gemini.generate(prompt, history);
    } catch (error) {
      failed++;
      console.log(`ERRO  ${testCase.name}: ${(error as Error).message}`);
      continue;
    }
    const problems = check(testCase, answer);
    if (problems.length === 0) {
      console.log(`ok    ${testCase.name}`);
    } else {
      failed++;
      console.log(`FALHA ${testCase.name}`);
      problems.forEach((p) => console.log(`        - ${p}`));
      console.log(`        resposta: ${answer.replace(/\n/g, ' ').slice(0, 300)}`);
    }
  }

  console.log(`\n${cases.length - failed}/${cases.length} casos ok`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
