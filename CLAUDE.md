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
- **Todo push vai direto para produção — revisar com cuidado antes de commitar**

## Objetivo atual
Corrigir bugs e problemas existentes — sem refatorações desnecessárias.

## Regras de trabalho
- NUNCA editar arquivos sem aprovação explícita
- NUNCA commitar sem revisar o diff completo
- Uma correção por sessão — não acumular mudanças
- Não refatorar código que está funcionando
- Não atualizar dependências sem necessidade
- Não fazer push sem entender o impacto — CI/CD leva direto para produção

## Fluxo de sessão padrão
1. Descrever o problema específico desta sessão
2. Claude analisa os arquivos relevantes
3. Claude propõe correção com explicação clara
4. Aprovação antes de qualquer edição
5. Revisão do diff antes do commit
6. git commit com mensagem descritiva
7. git push → CI/CD cuida do deploy

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
