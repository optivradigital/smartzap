# CLAUDE.md — SmartZAP

## O que é este projeto
SmartZAP é um SaaS de automação de envio de mensagens em massa via WhatsApp (Meta Cloud API,
não Evolution API — a integração é direto com WhatsApp Business/Meta). Multi-tenant, com
billing via Stripe, auth via Clerk, e integração com GPTMaker para agentes de IA. Objetivo
atual: corrigir bugs e evoluir o produto — sem refatorações desnecessárias.

## Stack e comandos
- **Next.js 16** (App Router) + React 19 + TypeScript
- Auth: **Clerk** (`@clerk/nextjs` v7) — proteção de rotas via `proxy.ts` na raiz
  (Next.js 16 usa `proxy.ts`, **não** `middleware.ts` — não existe `middleware.ts` neste
  projeto; confirme sempre a versão do Next antes de assumir qual arquivo usar).
  `proxy.ts` exporta `clerkMiddleware` como `proxy`, com rotas públicas em `isPublicRoute`.
- Banco: **Supabase** (PostgreSQL) — migrations em `supabase/`, aplicadas manualmente em
  staging e produção (`npm run db:migrate` roda `scripts/migrate.mjs`)
- Fila/workflows: Upstash Redis + QStash (`@upstash/qstash`, `@upstash/workflow`)
- Billing: Stripe (`stripe`)
- IA: AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) + GPTMaker
- UI: Tailwind v4, Radix UI, shadcn (`components.json`), Zustand, TanStack Query
- Testes: Vitest (unit, `npm test`) + Playwright (e2e, `npm run test:e2e`)
- Build: `npm run build` (webpack, não turbopack — `next build --webpack`); dev usa
  `next dev --turbopack`
- Lint: `npm run lint`

## Arquitetura / Deploy
- **Deploy self-hosted em EC2 (AWS)** via GitHub Actions — não usa Vercel (Vercel foi
  removido do projeto). Ver `.github/workflows/deploy.yml`:
  - Push em `main` → build da imagem Docker multi-arch (`docker/build-push-action`) →
    push para `ghcr.io/optivradigital/smartzap:latest` → deploy via SSH no EC2/Xango.
  - `Dockerfile` multi-stage (deps/builder/runner), standalone output do Next.js,
    container roda na porta 3002 como usuário `nextjs` não-root.
  - Build args do Docker exigem: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — declarados como
    ARG e ENV no Dockerfile e como secrets no workflow.
  - Workflows: apenas `deploy.yml` (produção, em `main`) e `test.yml` (CI de testes).
    **Não há mais staging** — `staging.yml` foi removido (2026-09-09): a imagem
    `:staging` só existia em amd64 e o ambiente de staging foi decomissionado na
    migração do servidor para o Xango (ver `ServidorAPPAWS/PROGRESS.md`).
- **Fluxo de branches: sem staging.** Trabalho normal na branch `develop`; PR de
  `develop` → `main` vai direto para produção após aprovação. Não recriar staging
  sem decisão explícita do usuário.
- Migrações de banco precisam ser aplicadas manualmente no Supabase (staging e produção
  separados).

## Estrutura principal
- `app/`          → rotas Next.js (App Router) e API routes
- `components/`   → componentes de UI
- `lib/`          → lógica de negócio
- `services/`     → integrações externas (WhatsApp/Meta, Supabase, GPTMaker etc.)
- `hooks/`        → React hooks
- `utils/`        → utilitários
- `supabase/`     → migrations e configuração do banco
- `scripts/`      → scripts auxiliares (ex.: `migrate.mjs`)
- `proxy.ts`      → auth middleware (Clerk) — substitui o antigo `middleware.ts`

## Regras de trabalho
- NUNCA editar arquivos sem aprovação explícita
- NUNCA commitar sem revisar o diff completo
- Não acumular mudanças não relacionadas num mesmo commit
- Não refatorar código que está funcionando
- Não atualizar dependências sem necessidade
- Trabalhar sempre na branch `develop` — nunca commitar direto em `main`
- Após qualquer migração/mudança de auth, auditar rotas de logout/signOut para usar a API
  correta do provedor (Clerk)

## Fluxo de sessão padrão
1. Descrever o problema específico desta sessão
2. Claude analisa os arquivos relevantes
3. Claude propõe correção com explicação clara
4. Aprovação antes de qualquer edição
5. Revisão do diff antes do commit
6. git commit com mensagem descritiva na branch `develop`
7. PR aberto para revisão — merge em `main` é aprovado pelo usuário

## Contexto de negócio
- Projeto da Optivra
- Automação B2B — cuidado com limites e bloqueios do WhatsApp/Meta
- Multi-tenant: sempre verificar isolamento por `org_id`/`orgId` em queries, mutations e
  middleware ao mexer em templates, dashboard, campanhas, CRM, integrações Meta
