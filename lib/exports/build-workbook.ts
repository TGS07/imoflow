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
  { header: 'Último contacto', width: 16, value: r => r.lastContactAt ? new Date(r.lastContactAt).toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '' },
]

// Tudo entra como texto: mantém o «+351» e o Excel não interpreta nada como fórmula.
export async function buildContactsWorkbook(rows: ExportRow[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Contactos', { views: [{ state: 'frozen', ySplit: 1 }] })

  sheet.columns = COLUMNS.map(c => ({ header: c.header, width: c.width }))
  sheet.getRow(1).font = { bold: true }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }
  for (const row of rows) sheet.addRow(COLUMNS.map(c => c.value(row)))

  return await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer
}
