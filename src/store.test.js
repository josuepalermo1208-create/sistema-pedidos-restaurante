import { describe, expect, it, vi } from 'vitest'
import { dateKey, normalizeSales } from './store'

describe('sales data from the API', () => {
  it('normalizes the backend date and Spanish field names', () => {
    const [sale] = normalizeSales([{
      id: 'sale-1',
      fecha: '2026-11-10T12:00:00Z',
      mesaId: 4,
      metodo: 'Efectivo',
      total: 250,
    }])

    expect(sale).toMatchObject({
      id: 'sale-1',
      paidAt: '2026-11-10T12:00:00Z',
      tableId: '4',
      tableName: '4',
      method: 'Efectivo',
      total: 250,
      items: [],
    })
  })

  it('keeps canonical fields and item details when provided', () => {
    const [sale] = normalizeSales([{
      id: 'sale-2',
      paidAt: '2026-11-10T12:00:00Z',
      tableId: '2',
      tableName: '02',
      method: 'Tarjeta',
      cashier: 'Alex',
      total: '120.50',
      items: [{ name: 'Limonada', quantity: 2 }],
    }])

    expect(sale).toMatchObject({
      tableName: '02',
      cashier: 'Alex',
      total: 120.5,
      items: [{ name: 'Limonada', quantity: 2 }],
    })
  })

  it('omits records with invalid dates without crashing date-based screens', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(normalizeSales([{ id: 'sale-invalid', fecha: 'not-a-date' }])).toEqual([])
    expect(dateKey(undefined)).toBe('')
    expect(error).toHaveBeenCalledOnce()

    error.mockRestore()
  })
})
