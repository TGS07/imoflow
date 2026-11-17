// Lê nas notas de um contacto a próxima chamada escrita à mão, ex.:
//   "ligar a 25/10", "voltar a ligar a17/11 - 17h", "Ligar dia 24.11.26",
//   "ligar a 1/01/2027", "C0404-00506 info enviada a 30/10, ligar a 11/11 - 19h"
// Só datas explícitas (dia/mês[/ano]) logo a seguir a "ligar"/"contactar"/…;
// expressões vagas ("ligar no próximo mês") são ignoradas.

export type NoteCall = { date: string; time: string | null }

const VERB = '(?:ligar|telefonar|contactar|liga-?lhe|ligo)'
// até ~30 caracteres de ligação ("a", "dia", "no dia", "quarta feira", …) sem atravessar outra frase
const GAP = '[^.\\n,;]{0,30}?'
// ano colado à data ("24.11.26", "1/01/2027"); nunca " - 17h" (isso é hora)
const DATE = '(\\d{1,2})\\s*[/.\\-]\\s*(\\d{1,2})(?:[/.](\\d{4}|\\d{2}(?![\\dh:])))?(?!\\d)'
const TIME = '(?:[^\\d\\n]{0,8}?(\\d{1,2})\\s*(?:h|:)\\s*(\\d{2})?)?'
const RE = new RegExp(`${VERB}${GAP}${DATE}${TIME}`, 'gi')

function pad(n: number) { return String(n).padStart(2, '0') }

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// `ref` = quando a nota foi escrita (ou hoje). Sem ano, assume a primeira
// ocorrência dessa data a partir de ~2 meses antes de `ref` (assim "ligar a
// 15/01" escrito em outubro é janeiro do ano seguinte).
export function parseCallFromNotes(notes: string | null | undefined, ref: Date = new Date()): NoteCall | null {
  if (!notes) return null
  let last: NoteCall | null = null
  for (const m of notes.matchAll(RE)) {
    const d = Number(m[1])
    const mo = Number(m[2])
    let y: number
    if (m[3]) {
      y = Number(m[3])
      if (y < 100) y += 2000
    } else {
      y = ref.getFullYear()
      const floor = new Date(ref.getFullYear(), ref.getMonth() - 2, ref.getDate())
      if (new Date(y, mo - 1, d) < floor) y += 1
    }
    if (!validDate(y, mo, d)) continue
    let time: string | null = null
    if (m[4]) {
      const h = Number(m[4])
      const min = m[5] ? Number(m[5]) : 0
      if (h >= 7 && h <= 22 && min < 60) time = `${pad(h)}:${pad(min)}`
    }
    // fica a última menção (a mais recente escrita na nota)
    last = { date: `${y}-${pad(mo)}-${pad(d)}`, time }
  }
  return last
}
