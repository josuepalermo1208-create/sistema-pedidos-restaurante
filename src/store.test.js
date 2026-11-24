import { describe, expect, it, vi } from 'vitest'
import {
  activeAccountRequests,
  dateKey,
  normalizeOrders,
  normalizeSales,
  orderTotal,
  reconcileAccountRequests,
  salesForCashier,
  shortTime,
} from './store'

describe('sales data from the API', () => {
  it('normalizes the backend date and Spanish field names', () => {
    const [sale] = normalizeSales([{
      id: 'sale-1',
      fecha: '2026-11-10T12:00:00Z',
      mesaId: 4,
      cajeroId: 9,
      metodo: 'Efectivo',
      total: 250,
    }])

    expect(sale).toMatchObject({
      id: 'sale-1',
      paidAt: '2026-11-10T12:00:00Z',
      tableId: '4',
      tableName: '4',
      cashierId: '9',
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

  it('filters cash register sales by cashier ID and falls back to the name for older records', () => {
    const sales = normalizeSales([
      { id: 'sale-1', fecha: '2026-11-24T12:00:00Z', cajeroId: 9, cajero: 'Alex', total: 100 },
      { id: 'sale-2', fecha: '2026-11-24T12:00:00Z', cajeroId: 10, cajero: 'Alex', total: 200 },
      { id: 'sale-3', fecha: '2026-11-24T12:00:00Z', cajero: 'Alex', total: 300 },
    ])

    expect(salesForCashier(sales, { id: 9, name: 'Alex' }, '2026-11-24').map((sale) => sale.id)).toEqual(['sale-1', 'sale-3'])
    expect(salesForCashier(sales, { id: 10, name: 'Alex' }, '2026-11-24').map((sale) => sale.id)).toEqual(['sale-2', 'sale-3'])
    expect(salesForCashier(sales, { name: 'Alex' }, '2026-11-24').map((sale) => sale.id)).toEqual(['sale-3'])
  })

  describe('API data used by staff screens', () => {
    it('normalizes alternate order fields and missing item arrays', () => {
      const [order] = normalizeOrders([{
        id: 'order-1',
        mesaId: 4,
        estado: 'Listo',
        fecha: '2026-11-11T12:00:00Z',
      }])

      expect(order).toMatchObject({
        tableId: '4',
        status: 'Listo',
        createdAt: '2026-11-11T12:00:00Z',
        items: [],
      })
    })

    it('normalizes Spanish item prices and quantities so account totals are calculable', () => {
      const [order] = normalizeOrders([{
        id: 'order-2',
        mesaId: 1,
        detalles: [{
          productoId: 7,
          nombreProducto: 'Tacos',
          precioUnitario: '85.50',
          cantidad: 2,
        }],
      }])

      expect(order.items[0]).toMatchObject({
        productId: '7',
        name: 'Tacos',
        price: 85.5,
        quantity: 2,
      })
      expect(orderTotal(order)).toBe(171)
    })

    it('uses the API order total when item prices are missing', () => {
      const [order] = normalizeOrders([{
        id: 'order-3',
        totalPedido: '95.5',
        items: [{ productId: '3', name: 'Agua', quantity: 1 }],
      }])

      expect(orderTotal(order)).toBe(95.5)
    })

    it('renders a placeholder instead of throwing on a missing time', () => {
      expect(shortTime(undefined)).toBe('—')
      expect(shortTime('invalid-date')).toBe('—')
    })
  })

  describe('account requests', () => {
    it('clears stale requests when the table has no unpaid orders', () => {
      const data = {
        accounts: { '1': { requested: true, attendedBy: 'Alex' } },
        tables: [{ id: 1, status: 'Cuenta solicitada' }],
        orders: [],
      }

      const reconciled = reconcileAccountRequests(data)

      expect(reconciled.accounts['1']).toMatchObject({
        requested: false,
        attendedBy: null,
        attendedAt: null,
      })
      expect(activeAccountRequests(reconciled)).toEqual([])
    })

    it('keeps a requested account when the table still has an unpaid order', () => {
      const data = {
        accounts: { '1': { requested: true, method: 'Efectivo' } },
        tables: [{ id: 1, status: 'Cuenta solicitada' }],
        orders: [{ id: 'order-1', tableId: '1', paid: false, items: [] }],
      }

      expect(activeAccountRequests(reconcileAccountRequests(data))).toHaveLength(1)
    })

    it('does not resurrect a cleared API request when a new order is added', () => {
      const staleRequest = reconcileAccountRequests({
        accounts: {},
        tables: [{ id: 1, status: 'Cuenta solicitada' }],
        orders: [],
      })

      const afterNewOrder = reconcileAccountRequests({
        ...staleRequest,
        orders: [{ id: 'order-2', tableId: '1', paid: false, items: [] }],
      })

      expect(afterNewOrder.accounts['1'].requested).toBe(false)
      expect(activeAccountRequests(afterNewOrder)).toEqual([])
    })

    it('restores a request when the API confirms account items and open orders', () => {
      const data = {
        accounts: { '1': { requested: false, items: [{ id: 'item-1' }] } },
        tables: [{ id: 1, status: 'Cuenta solicitada' }],
        orders: [{ id: 'order-1', tableId: '1', paid: false, items: [] }],
      }

      expect(activeAccountRequests(reconcileAccountRequests(data))).toHaveLength(1)
    })

    it('keeps an API table request inactive when there are no open orders', () => {
      const data = {
        accounts: {},
        tables: [{ id: 1, status: 'Cuenta solicitada' }],
        orders: [{ id: 'order-1', tableId: '1', paid: true, items: [] }],
      }

      expect(reconcileAccountRequests(data).accounts['1'].requested).toBe(false)
    })

    it('loads a real API request when an unpaid order exists', () => {
      const data = {
        accounts: {},
        tables: [{ id: 1, status: 'Cuenta solicitada' }],
        orders: [{ id: 'order-1', tableId: '1', paid: false, items: [] }],
      }

      expect(reconcileAccountRequests(data).accounts['1'].requested).toBe(true)
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
