import { describe, expect, it } from 'vitest'
import { createCashierPdf } from './cashierPdf'

describe('cashier PDF', () => {
  it('creates a PDF containing the cash register report', () => {
    const pdf = createCashierPdf({
      date: '2026-11-24',
      cashier: 'Alex',
      sales: [{
        id: 'sale-1',
        paidAt: '2026-11-24T12:00:00Z',
        tableName: '04',
        method: 'Efectivo',
        total: 185,
      }],
      cashTotal: 185,
      cardTotal: 0,
    })
    const pdfContent = Buffer.from(pdf.output('arraybuffer')).toString('latin1')

    expect(pdfContent.startsWith('%PDF-')).toBe(true)
    expect(pdfContent).toContain('CORTE DE CAJA')
    expect(pdfContent).toContain('sale-1')
  })
})
