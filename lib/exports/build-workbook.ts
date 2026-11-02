import ExcelJS from 'exceljs'
import type { ExportRow } from './contacts'

const COLUMNS: { header: string; width: number; value: (row: ExportRow) => string }[] = [
  { header: 'Nome', width: 30, value: r => r.name },
  { header: 'Telefone', width: 18, value: r => r.phone ?? '' },
  { header: 'Email', width: 32, value: r => r.email ?? '' },
  { header: 'Pipeline', width: 20, value: r => r.pipeline },
  { header: 'Fase', width: 26, value: r => r.stage },
  { header: 'Temperatura', width: 14, value: r => r.temperature ? r.temperature[0].toUpperCase() + r.temperature.slice(1) : '' },
  { header: 'Consultor', width: 22, value: r => r.consultant ?? '' },
  { header: 'Imóvel', width: 34, value: r => r.property ?? '' },
  { header: 'Link do anúncio', width: 40, value: r => r.link ?? '' },
  { header: 'Notas', width: 60, value: r => r.notes ?? '' },
  { header: 'Último contacto', width: 16, value: r => r.lastContactAt ? new Date(r.lastContactAt).toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '' },
]

const LINK_COLUMN = COLUMNS.findIndex(c => c.header === 'Link do anúncio') + 1

// Tudo entra como texto: mantém o «+351» e o Excel não interpreta nada como fórmula.
// Só links http(s) ficam clicáveis, para o ficheiro nunca abrir outro tipo de endereço.
export async function buildContactsWorkbook(rows: ExportRow[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Contactos', { views: [{ state: 'frozen', ySplit: 1 }] })

  sheet.columns = COLUMNS.map(c => ({ header: c.header, width: c.width }))
  sheet.getRow(1).font = { bold: true }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }
  for (const row of rows) {
    const added = sheet.addRow(COLUMNS.map(c => c.value(row)))
    if (row.link && /^https?:\/\//i.test(row.link)) {
      const cell = added.getCell(LINK_COLUMN)
      cell.value = { text: row.link, hyperlink: row.link }
      cell.font = { color: { argb: 'FF0563C1' }, underline: true }
    }
  }

  return await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer
}
