// Normaliza um número para o formato internacional sem '+' (ex: 351912345678).
// Números PT de 9 dígitos ganham o indicativo 351 por omissão.
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `351${digits}`
  return digits
}

export function buildWaLink(phone: string, text: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`
}
