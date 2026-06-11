# Configurar a WhatsApp Business API no ImoFlow

O ImoFlow tem duas camadas de WhatsApp:

| Funcionalidade | Precisa de configuração? |
|---|---|
| **Respostas rápidas** (botão WhatsApp na lead, abre o WhatsApp com a mensagem pronta) | ❌ Não — funciona já |
| **Automações** (resposta automática a mensagens recebidas, envio automático de WhatsApp) | ✅ Sim — WhatsApp Business API |

Este guia cobre a segunda parte.

## O que vais precisar

- Uma conta **Meta Business** (https://business.facebook.com)
- Um **número de telefone dedicado** que NÃO esteja registado em nenhuma conta de WhatsApp normal (não podes usar o teu número pessoal — perderia o WhatsApp normal)
- Cartão de crédito para a faturação da Meta

## Custos (aproximados, 2026)

- A Meta cobra **por conversa de 24 horas**, não por mensagem.
- Conversas iniciadas pela empresa (ex: follow-up automático): ~0,05–0,08 € cada em Portugal.
- Conversas de **serviço** (a lead escreve primeiro e tu respondes na janela de 24h): gratuitas em volume básico.
- As primeiras 1000 conversas de serviço por mês são gratuitas.

## Limitação importante: a janela de 24 horas

Só podes enviar **texto livre** a uma lead nas **24 horas seguintes** à última mensagem dela.
Fora dessa janela, a Meta exige **templates pré-aprovados** (submetidos no painel da Meta e aprovados manualmente).
Na prática: a automação "responder a mensagem recebida" funciona sempre; o "envio automático após X dias" exige um template aprovado pela Meta.

## Passo a passo

### 1. Criar a app na Meta

1. Vai a https://developers.facebook.com → **My Apps** → **Create App**
2. Tipo: **Business** → associa a tua conta Meta Business
3. No painel da app, adiciona o produto **WhatsApp**

### 2. Registar o número

1. Em **WhatsApp → API Setup**, adiciona o teu número dedicado
2. Confirma o código de verificação por SMS
3. Anota o **Phone Number ID** (aparece por baixo do número)

### 3. Gerar o token de acesso permanente

O token de teste expira em 24h. Para produção:

1. Em https://business.facebook.com/settings → **System Users** → cria um system user (papel: Admin)
2. **Add Assets** → associa a tua app de WhatsApp
3. **Generate New Token** → seleciona a app → permissões: `whatsapp_business_messaging` e `whatsapp_business_management`
4. Guarda o token (só aparece uma vez)

### 4. Configurar as variáveis de ambiente

No Vercel (Settings → Environment Variables) ou no `.env.local`:

```
WHATSAPP_ACCESS_TOKEN=<token do passo 3>
WHATSAPP_PHONE_NUMBER_ID=<Phone Number ID do passo 2>
WHATSAPP_VERIFY_TOKEN=<inventa uma string aleatória, ex: imoflow-wh-8f3k2>
```

Depois faz redeploy.

### 5. Configurar o webhook

1. No painel da app Meta: **WhatsApp → Configuration → Webhook → Edit**
2. **Callback URL:** `https://<o-teu-dominio>/api/whatsapp/webhook`
3. **Verify token:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
4. Clica **Verify and Save** (a Meta chama o endpoint GET; o ImoFlow responde automaticamente)
5. Em **Webhook fields**, subscreve **messages**

### 6. Testar

1. Cria uma lead no ImoFlow com o teu número de telemóvel pessoal
2. Em Configurações → Automações, cria uma regra:
   - **Quando:** Mensagem WhatsApp recebida
   - **Então:** Enviar WhatsApp automático → escolhe um template
3. Envia uma mensagem WhatsApp do teu telemóvel para o número da empresa
4. Deves receber a resposta automática em segundos
5. Verifica os logs da regra na página de Automações

## Casos de uso recomendados

- **Resposta automática imediata**: a lead escreve, recebe logo "Olá {{nome}}! Recebemos a tua mensagem, o {{agente}} responde-te em breve." — ninguém fica sem resposta.
- **Fora de horas**: o mesmo, com mensagem de horário.
- **Follow-up de inatividade**: regra "Lead inativa X dias → Enviar WhatsApp" (exige template aprovado pela Meta se fora da janela de 24h).

## Alternativa: Twilio

Se preferires usar a Twilio (faturação mais simples, mas com margem em cima do preço da Meta), o código em `lib/whatsapp/send.ts` teria de ser adaptado ao endpoint da Twilio. Diz ao Claude "muda o envio de WhatsApp para Twilio" quando quiseres.
