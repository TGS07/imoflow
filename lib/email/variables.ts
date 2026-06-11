export type TemplateVars = {
  nome?: string | null
  email?: string | null
  telefone?: string | null
  agente?: string | null
  agencia?: string | null
}

// Substitui {{variavel}} pelos dados da lead/agente. Variáveis sem valor ficam intactas.
export function fillVariables(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key as keyof TemplateVars]
    return value != null && value !== '' ? String(value) : match
  })
}

export const AVAILABLE_VARIABLES = ['nome', 'email', 'telefone', 'agente', 'agencia'] as const
