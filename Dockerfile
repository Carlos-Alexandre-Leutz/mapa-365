# Uma imagem por serviço: docker build --build-arg SERVICE=api|bff|web .
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN pnpm add -g turbo
WORKDIR /app

FROM base AS pruner
ARG SERVICE
COPY . .
RUN turbo prune @mapa365/${SERVICE} --docker

FROM base AS installer
ARG SERVICE
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

RUN if [ "$SERVICE" = "api" ]; then \
      pnpm --filter=@mapa365/api exec prisma generate --schema=./prisma/schema.prisma; \
    fi

# NEXT_PUBLIC_* é gravada no bundle do Next durante o build, então precisa chegar aqui
ARG NEXT_PUBLIC_BFF_URL
ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL

RUN pnpm turbo build --filter=@mapa365/${SERVICE}

FROM base AS runner
ARG SERVICE
ENV SERVICE=${SERVICE}
ENV NODE_ENV=production
WORKDIR /app
COPY --from=installer /app .

CMD ["sh", "-c", "if [ \"$SERVICE\" = \"web\" ]; then exec pnpm --filter @mapa365/web start; else exec pnpm --filter @mapa365/$SERVICE start:prod; fi"]
