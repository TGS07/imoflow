# Configurar notificações por Telegram no ImoFlow

O ImoFlow envia todas as notificações do sistema (novas leads, mudanças de
etapa, avisos de automação — incluindo os novos avisos de etapa) também
por Telegram, além de email, quando o utilizador tem a conta ligada.

## O que já existe

- Cada utilizador liga a sua conta em **Definições → Equipa**, botão
  "Ligar Telegram" (abre `t.me/Imoflowbot?start=<id do utilizador>`).
- A coluna `public.users.telegram_chat_id` já existe na base de dados
  (criada pelo projeto `idealista-bot`, partilha a mesma base Supabase).

## O que falta para o botão funcionar

Ninguém responde ainda ao `/start` enviado pelo Telegram — é preciso um
processo com acesso ao `TELEGRAM_BOT_TOKEN` que:
1. Receba o update `/start <user_id>` (via webhook ou polling do bot
   `Imoflowbot`).
2. Grave `telegram_chat_id = <chat.id do update>` na linha de `users` com
   esse `id`.

Isto é responsabilidade do projeto `idealista-bot` (que já vai precisar de
receber updates deste mesmo bot para os botões dos cartões de imóveis) —
**não construir um segundo recetor aqui no ImoFlow**, para evitar dois
processos a competir pelas mesmas updates do Telegram (só um pode receber
de cada vez, via `setWebhook` ou `getUpdates`).

## Configurar o envio (este repositório)

No Vercel (Settings → Environment Variables) ou no `.env.local`:

```
TELEGRAM_BOT_TOKEN=<o token do bot @Imoflowbot, o mesmo do idealista-bot>
```

Depois faz redeploy. Não é preciso mais nenhum passo — `sendMessage` da
API do Telegram funciona com qualquer processo que tenha o token, mesmo
que não seja o que está a receber updates.

## Testar

1. Insere manualmente um `telegram_chat_id` de teste (o teu próprio chat
   com o bot) numa linha de `users`.
2. Cria uma lead nova atribuída a esse utilizador.
3. Deves receber a notificação no Telegram poucos segundos depois, em
   paralelo ao email (se `email_notifications` estiver ativo).
