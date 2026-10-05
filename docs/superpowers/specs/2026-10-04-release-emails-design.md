# Emails automáticos de novidades (por deploy)

## Objetivo
Cada deploy de produção envia um email aos utilizadores da FormaCR a explicar, em linguagem simples, o que mudou.

## Decisões
- Gatilho: **um email por deploy** (sem digest).
- Conteúdo: **todos os commits** do deploy, resumidos por IA (Groq, `lib/ai/client.ts`) em PT, sem jargão. Se a IA concluir que nada afeta o utilizador, **não envia**.
- Destinatários: **todos os utilizadores** (`users.email`), exceto quem fez opt-out.
- Remetente: `EMAIL_FROM` (atualmente `onboarding@resend.dev`). Limitação: o Resend só entrega ao dono da conta até haver domínio verificado. Falhas por destinatário são registadas e não interrompem o envio.

## Fluxo
1. GitHub Action `.github/workflows/release-notify.yml`, no evento `deployment_status` (state `success`, environment `Production`).
2. A Action faz `GET /api/release-notes/last` (Bearer `CRON_SECRET`) para obter o último sha notificado, calcula `git log <last>..<sha>` (fallback: últimos 10 commits) e faz `POST /api/release-notes/ingest` com `{ sha, commits[] }`.
3. `ingest` (idempotente por sha):
   - insere linha em `release_notes` (`sha` único, `commits`, `summary`, `status`, `sent_count`, `failed_count`, `created_at`, `sent_at`);
   - gera o resumo com o Groq; se vazio, `status = 'skipped'`;
   - se `RELEASE_EMAILS_ENABLED !== 'true'`, envia só a `SUPER_ADMIN_EMAIL`; caso contrário a todos os utilizadores sem opt-out;
   - envia por Resend em lotes, regista contagens, `status = 'sent' | 'partial' | 'failed'`.

## Componentes
- `supabase/migrations/20261004000000_release_notes.sql` (aditiva): tabela `release_notes` (RLS ativo, sem policies, só service role) e `users.product_updates_opt_out boolean not null default false`.
- `lib/release-notes/summarize.ts`: commits -> resumo PT (prompt: ignorar perf/infra/refactor, 3-6 pontos, tom para agentes imobiliários).
- `lib/release-notes/email.ts`: template HTML + texto simples, link de cancelar subscrição.
- `lib/release-notes/send.ts`: envio em lotes com tolerância a falhas.
- `lib/release-notes/unsubscribe-token.ts`: token HMAC (segredo `CRON_SECRET`) por user id.
- `app/api/release-notes/{last,ingest}/route.ts`: autenticados com Bearer `CRON_SECRET`.
- `app/(public)/unsubscribe/...`: página pública que valida o token e marca o opt-out.
- `.github/workflows/release-notify.yml`.

## Erros e segurança
- Sem Bearer válido: 401. Sha repetido: 200 sem reenviar.
- Falha da IA: `status = 'failed'`, sem envio de conteúdo em bruto.
- `RELEASE_EMAILS_ENABLED` começa desligada.
- Segredos da Action: `RELEASE_NOTIFY_URL` e `CRON_SECRET`.

## Verificação
Sem suite de testes no projeto: verificar com `tsc`, lint, chamada manual ao `ingest` em modo flag desligada (só super-admin) e validação do token de unsubscribe.

## Fora de âmbito
Domínio próprio no Resend (passo manual: verificar domínio, definir `EMAIL_FROM`), UI de histórico no admin.
