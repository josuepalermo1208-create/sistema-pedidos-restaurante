export const STORAGE_KEY = 'lumbre-pos-v1'

const today = () => new Date().toISOString().slice(0, 10)

export function createInitialData() {
  return {
    products: [],
    tables: [],
    users: [],
    devices: [],
    orders: [],
    accounts: {},
    sales: [],
    events: [],
  }
}

export function loadData() {
  return createInitialData()
}

export function normalizeSales(records) {
  if (!Array.isArray(records)) throw new TypeError('La respuesta de ventas debe ser una lista.')

  return records.flatMap((sale) => {
    const paidAt = sale.paidAt || sale.fecha || sale.createdAt
    if (!paidAt || Number.isNaN(new Date(paidAt).getTime())) {
      console.error(`La venta ${sale.id || '(sin id)'} no contiene una fecha válida y fue omitida.`)
      return []
    }

    return [{
      ...sale,
      paidAt,
      method: sale.method || sale.metodo,
      tableId: String(sale.tableId ?? sale.mesaId ?? ''),
      tableName: sale.tableName || sale.mesaNombre || String(sale.mesaId ?? sale.tableId ?? ''),
      cashier: sale.cashier || sale.cajero || '',
      total: Number(sale.total ?? sale.cobrado ?? 0),
      items: Array.isArray(sale.items) ? sale.items : [],
    }]
  })
}

export function money(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0)
}

export function orderTotal(order) {
  return order.items.reduce((total, item) => total + item.price * item.quantity, 0)
}

export function tableOrders(data, tableId) {
  return data.orders.filter((order) => order.tableId === tableId && !order.paid)
}

export function tableTotal(data, tableId) {
  return tableOrders(data, tableId).reduce((total, order) => total + orderTotal(order), 0)
}

export function tableStatus(data, tableId) {
  const openOrders = tableOrders(data, tableId)
  if (!openOrders.length) return 'Libre'
  if (data.accounts[tableId]?.requested) return 'Cuenta solicitada'
  return 'Ocupada'
}

export function withEvent(data, type, actor, description) {
  const event = { id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: new Date().toISOString(), type, actor, description }
  return { ...data, events: [event, ...data.events].slice(0, 500) }
}

export function dateKey(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export const todayKey = today
