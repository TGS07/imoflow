# Web Push Notifications — Design Spec

**Data:** 2026-08-09
**Objectivo:** Enviar notificações push nativas (iOS PWA 16.4+ e Android) para eventos críticos, usando a Web Push API com VAPID.

---

## Contexto

O ImoFlow já tem:
- Service worker mínimo (`public/sw.js`) — installability + fallback offline
- Manifest PWA completo (`app/manifest.ts`) — standalone, icons
- Sistema de notificações in-app (`lib/notifications.ts`) — cria notificações na BD, envia email (Resend) e Telegram
- UI NotificationBell com polling a cada 5 min

Falta: Web Push. Não existe tabela de subscrições, nem pacote `web-push`, nem VAPID keys.

---

## Tipos de notificação com push

Apenas dois tipos disparam push (os mais urgentes e acionáveis):
- `new_lead` — novo lead criado
- `task_due` — tarefa por fazer/vencida

Os restantes tipos (`lead_stage_changed`, `email_received`, `automation_rule_triggered`, `special_date`) continuam apenas in-app + email + Telegram.

---

## 1. Base de dados

Nova tabela `push_subscriptions`:

| Coluna      | Tipo          | Notas                              |
|-------------|---------------|------------------------------------|
| id          | uuid (PK)     | gen_random_uuid()                  |
| user_id     | uuid (FK)     | → auth.users                       |
| agency_id   | uuid (FK)     | → agencies                         |
| endpoint    | text (unique) | URL do push service do browser     |
| p256dh      | text          | Chave de encriptação pública       |
| auth        | text          | Token de autenticação              |
| created_at  | timestamptz   | default now()                      |

- Um user pode ter várias subscrições (telemóvel + computador).
- RLS: cada user só vê/gere as suas subscrições.
- Quando o envio falha com 410 Gone ou 404, a linha é apagada automaticamente.

---

## 2. Service Worker (`public/sw.js`)

Adicionar dois event listeners ao SW existente:

### `push`
- Recebe payload JSON: `{ title, body, link, icon }`
- Mostra notificação nativa via `self.registration.showNotification(title, { body, icon, data: { link } })`

### `notificationclick`
- Ao clicar na notificação, abre a app no `link` do payload
- Se já houver uma janela/tab aberta, foca-a e navega; caso contrário abre nova

---

## 3. API Routes

### `POST /api/push/subscribe`
- Autenticado (verifica sessão)
- Body: `{ endpoint, keys: { p256dh, auth } }`
- Faz upsert na tabela `push_subscriptions` (conflict on `endpoint`)
- Retorna 200

### `DELETE /api/push/subscribe`
- Autenticado
- Body: `{ endpoint }`
- Apaga a subscrição com aquele endpoint para o user actual
- Retorna 200

---

## 4. Envio push em `lib/notifications.ts`

No `createNotification()`, após os blocos de email e Telegram, adicionar bloco de Web Push:

1. Verificar se `type` é `new_lead` ou `task_due` — se não, skip
2. Buscar todas as `push_subscriptions` do `userId`
3. Para cada subscrição, enviar via `web-push` (pacote npm):
   - Payload: `{ title, body, link, icon: '/icon-192.png' }`
   - Se falhar com status 410 ou 404 → apagar a subscrição (browser revogou)
   - Erros não bloqueiam o fluxo principal

---

## 5. Frontend

### 5a. Banner `PushBanner`

- Renderizado no `AppShell`, por cima do conteúdo principal
- Aparece se:
  - O browser suporta Push API e Service Workers
  - O user não tem subscrição push neste dispositivo
  - O user não recusou anteriormente (flag `push_banner_dismissed` no localStorage)
- Conteúdo: "Ative notificações para não perder novos leads e tarefas" + botão "Ativar"
- Fluxo do botão:
  1. `Notification.requestPermission()`
  2. Se granted → `registration.pushManager.subscribe()` com VAPID public key
  3. `POST /api/push/subscribe` com a subscrição
  4. Banner desaparece
- Se o user recusar o pedido do browser ou fechar o banner → guarda flag no localStorage

### 5b. Toggle nas Definições

- Página Definições > Notificações (já existente)
- Novo toggle: "Notificações Push neste dispositivo"
- Estados:
  - **Ativo** — subscrição existe, toggle ligado
  - **Desativado** — toggle desligado
  - **Bloqueado** — permissão negada no browser, mostra texto explicativo
  - **Não suportado** — browser/OS não suporta Push API, toggle desabilitado com nota

---

## 6. VAPID Keys

- Geradas com `npx web-push generate-vapid-keys`
- Variáveis de ambiente (Vercel):
  - `VAPID_PUBLIC_KEY` — também usada no frontend (é pública)
  - `VAPID_PRIVATE_KEY` — só no servidor
  - `VAPID_EMAIL` — email de contacto (ex: `mailto:tomasmsampaio@gmail.com`)
- A chave pública é exposta ao frontend via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

---

## Abordagem escolhida

**web-push (Node.js)** — envio directo do servidor Next.js. Zero custo, sem serviços terceiros, integra-se no `createNotification()` existente ao lado do email e Telegram.

---

## Fora de escopo

- Push para tipos além de `new_lead` e `task_due`
- Dashboard de analytics de push
- Agrupamento/batching de notificações
- Rich notifications (imagens, acções inline)
