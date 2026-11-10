FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN pnpm add -g turbo
WORKDIR /app

FROM base AS pruner
COPY . .
RUN turbo prune @saas/api-tasks bff @saas/web --docker

FROM base AS installer
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

RUN pnpm --filter=@saas/api-tasks exec prisma generate --schema=./prisma/schema.prisma

RUN pnpm turbo build

FROM base AS runner
WORKDIR /app

COPY --from=installer /app .

CMD ["pnpm", "start"]