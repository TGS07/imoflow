// Envio de mensagens Telegram (só envio — a receção de updates deste bot
// é responsabilidade do projeto idealista-bot, ver docs/TELEGRAM_SETUP.md).

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!isTelegramConfigured()) {
    throw new Error('Telegram não configurado (falta TELEGRAM_BOT_TOKEN)')
  }

  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  )

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`Telegram API: ${data?.description ?? res.statusText}`)
  }
}
