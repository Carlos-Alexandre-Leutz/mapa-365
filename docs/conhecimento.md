# Base de conhecimento da IA

O que a IA diz vem de arquivos fora do código, em `apps/api/knowledge/`. A pasta **não vai para o Git** (está no `.gitignore`), porque tem preço, garantia e regras comerciais reais.

| Arquivo | Para que serve |
|---|---|
| `prompt.md` | Roteiro e regras da IA. Aceita variáveis no formato `{{NOME}}`. |
| `variables.json` | Valores das variáveis (preço, link de compra, vagas...). |

Sem a pasta `knowledge/`, a API usa `apps/api/knowledge.example/`, com dados fictícios, e avisa no log.

## Como usar

1. Copie `knowledge.example/` para `knowledge/` e edite os arquivos.
2. No servidor, aponte para a pasta com `KNOWLEDGE_DIR=/caminho/da/pasta` (ou deixe em `apps/api/knowledge`).
3. Os arquivos são relidos a cada mensagem. Editar não exige reiniciar a API.

## Marcadores que a IA pode escrever

| Marcador | Efeito |
|---|---|
| `[[HUMANO]]` | A IA para de responder naquela conversa e o responsável é avisado. O marcador é removido antes de enviar a resposta. |

Variáveis sem valor em `variables.json` continuam aparecendo como `{{NOME}}` no prompt, com um aviso no log. Confira o log depois de editar.

## No servidor

O `docker-compose.yml` monta a pasta do servidor `KNOWLEDGE_HOST_DIR` (padrão `./knowledge`, ao lado do compose) como `/knowledge`, somente leitura, e aponta `KNOWLEDGE_DIR` para ela. O `.dockerignore` impede que `knowledge/` entre na imagem, e o `.gitignore`, que entre no repositório. Para atualizar o atendimento basta editar os arquivos no servidor: eles são relidos a cada mensagem, sem rebuild nem restart.
