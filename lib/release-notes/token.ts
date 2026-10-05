import { createHmac, timingSafeEqual } from 'node:crypto'

function sign(userId: string): string {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET not set')
  return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('hex')
}

export function signUnsubscribeToken(userId: string): string {
  return sign(userId)
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(sign(userId))
  const received = Buffer.from(token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
