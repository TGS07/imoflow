import { randomBytes } from 'crypto'

// Chave secreta de uma ligação externa: prefixo legível + 32 bytes aleatórios
export function generateWebhookToken(): string {
  return `imf_${randomBytes(32).toString('base64url')}`
}
