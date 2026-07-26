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

// Formata para leitura: "+351 987233111". Números que normalizam para mais
// de 9 dígitos assumem que os dígitos a mais no início são o indicativo;
// sem indicativo reconhecível (9 dígitos ou menos, ou não numérico),
// devolve o valor original tal como foi guardado.
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!/^\d+$/.test(normalized)) return phone
  if (normalized.length > 9) {
    const country = normalized.slice(0, normalized.length - 9)
    const rest = normalized.slice(-9)
    return `+${country} ${rest}`
  }
  return phone
}
