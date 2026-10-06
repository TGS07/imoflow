# Emails de novidades por deploy — plano de implementação

> Spec: `docs/superpowers/specs/2026-10-04-release-emails-design.md`. Execução inline (sem suite de testes no projeto; verificação com `tsc`, `eslint` e chamadas manuais).

**Goal:** cada deploy de produção gera um email de novidades (resumo por IA) para todos os utilizadores.
**Architecture:** GitHub Action -> `POST /api/release-notes/ingest` -> Groq resume -> Resend envia em lotes; `release_notes` regista cada deploy (idempotente por sha).
**Tech Stack:** Next.js 16 route handlers, Supabase (service client), Resend 6 (`batch.send`), Groq via `openai` SDK.

## Tarefas
1. **Migração** `supabase/migrations/20261005000000_release_notes.sql`: tabela `release_notes` (RLS ativo, sem policies) + `users.product_updates_opt_out`. Aplicar no Supabase só com autorização (produção).
2. **Token** `lib/release-notes/token.ts`: HMAC-SHA256 do `user id` com `CRON_SECRET`; `signUnsubscribeToken`, `verifyUnsubscribeToken` (timingSafeEqual).
3. **Resumo** `lib/release-notes/summarize.ts`: commits -> `string[]` (0 a 6 pontos, JSON do Groq); `[]` = nada relevante.
4. **Email** `lib/release-notes/email.ts`: `renderReleaseEmail(items, unsubscribeUrl)` -> `{ subject, html, text }` (HTML escapado).
5. **Envio** `lib/release-notes/send.ts`: destinatários (flag off => só `SUPER_ADMIN_EMAIL`), lotes de 100 com `resend.batch.send`, contagem de enviados/falhados.
6. **Rotas** `app/api/release-notes/{last,ingest,unsubscribe}/route.ts`. `/api/*` está fora do matcher do `proxy.ts`, por isso não precisa de login.
7. **Action** `.github/workflows/release-notify.yml` (`deployment_status` success, Production).
8. **Verificação**: `npx tsc --noEmit`, `npx eslint` nos ficheiros novos, teste manual do token e do `ingest` (flag off).
9. **Commit** por tarefa e PR no fim.
