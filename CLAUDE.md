# CLAUDE.md — SmartZAP

## O que é este projeto
SmartZAP é uma aplicação de automação de envio de mensagens em massa via WhatsApp,
construída sobre a Evolution API. O objetivo atual é corrigir problemas existentes.

## Stack
- Next.js (frontend + API routes)
- TypeScript
- Supabase (PostgreSQL — banco principal)
- Upstash Redis + QStash (fila de mensagens e workflows)
- WhatsApp API (Meta Business)
- Docker (containerização)
- Vercel / AWS (deploy via CI/CD automático)

## Infraestrutura
- Servidor: AWS (produção)
- Versionamento: Git com CI/CD configurado
- **Fluxo de branches: `develop` → staging | `main` → produção**
- Push vai para `develop`. Produção só após PR aprovado e merge em `main`.
- Migrações de banco precisam ser aplicadas manualmente no Supabase (staging e produção separados).

## Objetivo atual
Corrigir bugs e evoluir o produto — sem refatorações desnecessárias.

## Regras de trabalho
- NUNCA editar arquivos sem aprovação explícita
- NUNCA commitar sem revisar o diff completo
- Não acumular mudanças não relacionadas num mesmo commit
- Não refatorar código que está funcionando
- Não atualizar dependências sem necessidade
- Trabalhar sempre na branch `develop` — nunca commitar direto em `main`

## Fluxo de sessão padrão
1. Descrever o problema específico desta sessão
2. Claude analisa os arquivos relevantes
3. Claude propõe correção com explicação clara
4. Aprovação antes de qualquer edição
5. Revisão do diff antes do commit
6. git commit com mensagem descritiva na branch `develop`
7. PR aberto para revisão — merge em `main` é aprovado pelo usuário

## Estrutura principal
- app/          → rotas Next.js e API routes
- components/   → componentes de UI
- lib/          → lógica de negócio
- services/     → integrações externas (WhatsApp, Supabase etc.)
- hooks/        → React hooks
- utils/        → utilitários
- supabase/     → migrations e configuração do banco
- scripts/      → scripts auxiliares

## Contexto de negócio
- Projeto da Optivra
- Automação B2B — cuidado com limites e bloqueios do WhatsApp
- Verificar sempre compatibilidade de versão da Evolution API antes de mudanças
