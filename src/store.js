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
      cashierId: String(sale.cashierId ?? sale.cajeroId ?? ''),
      total: Number(sale.total ?? sale.cobrado ?? 0),
      items: Array.isArray(sale.items) ? sale.items : [],
    }]
  })
}

export function salesForCashier(sales, cashier, date) {
  const cashierId = String(cashier?.id ?? '')
  return sales.filter((sale) => {
    const matchesCashier = sale.cashierId != null && sale.cashierId !== ''
      ? String(sale.cashierId) === cashierId
      : sale.cashier === cashier?.name
    return matchesCashier && dateKey(sale.paidAt) === date
  })
}

export function normalizeOrders(records) {
  if (!Array.isArray(records)) throw new TypeError('La respuesta de pedidos debe ser una lista.')

  return records.map((order) => {
    const rawItems = [order.items, order.detalles, order.detallePedido, order.productos]
      .find(Array.isArray) || []
    const items = rawItems.map((item) => {
      const product = item.product || item.producto || {}
      const quantity = Number(item.quantity ?? item.cantidad ?? item.cantidadProductos)
      const lineTotal = item.lineTotal ?? item.subtotal ?? item.importe ?? item.totalLinea ?? item.total
      const rawPrice = item.price
        ?? item.precio
        ?? item.unitPrice
        ?? item.precioUnitario
        ?? product.price
        ?? product.precio
      const price = rawPrice != null && rawPrice !== ''
        ? Number(rawPrice)
        : lineTotal != null && Number.isFinite(quantity) && quantity > 0
          ? Number(lineTotal) / quantity
          : Number.NaN

      return {
        ...item,
        productId: String(item.productId ?? item.productoId ?? item.idProducto ?? product.id ?? ''),
        name: item.name || item.nombre || item.nombreProducto || item.productoNombre || product.name || product.nombre || '',
        price,
        quantity,
      }
    })
    const totalValue = order.total ?? order.totalPedido ?? order.importe
    const total = totalValue == null ? undefined : Number(totalValue)

    if (items.some((item) => !Number.isFinite(item.price) || !Number.isFinite(item.quantity)) && !Number.isFinite(total)) {
      console.error(`El pedido ${order.id || '(sin id)'} contiene artículos sin precio o cantidad válidos.`)
    }

    return {
      ...order,
      tableId: String(order.tableId ?? order.mesaId ?? ''),
      status: order.status || order.estado || 'Estado desconocido',
      createdAt: order.createdAt || order.fecha || '',
      total,
      items,
    }
  })
}

export function shortTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function money(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0)
}

export function orderTotal(order) {
  const itemsTotal = order.items.reduce((total, item) => total + item.price * item.quantity, 0)
  if (order.items.length && Number.isFinite(itemsTotal)) return itemsTotal
  if (Number.isFinite(order.total)) return order.total
  return itemsTotal
}

export function tableOrders(data, tableId) {
  return data.orders.filter((order) => order.tableId === tableId && !order.paid)
}

export function activeAccountRequests(data) {
  return Object.entries(data.accounts).filter(([tableId, account]) => (
    account.requested && tableOrders(data, tableId).length > 0
  ))
}

export function reconcileAccountRequests(data) {
  const openTableIds = new Set(data.orders.filter((order) => !order.paid).map((order) => String(order.tableId)))
  const requestedTableIds = new Set(data.tables
    .filter((table) => String(table.status || '').trim().toLowerCase() === 'cuenta solicitada')
    .map((table) => String(table.id)))
  const accounts = { ...data.accounts }
  const tableIds = new Set([...Object.keys(accounts), ...requestedTableIds])

  tableIds.forEach((tableId) => {
    const account = accounts[tableId]
    const hasOpenOrders = openTableIds.has(tableId)
    const apiRequested = requestedTableIds.has(tableId)

    if (account?.requested === true && !hasOpenOrders) {
      accounts[tableId] = { ...account, requested: false, attendedBy: null, attendedAt: null }
    } else if (account?.requested === false && !apiRequested) {
      const rest = { ...account }
      delete rest.requested
      if (Object.keys(rest).length) accounts[tableId] = rest
      else delete accounts[tableId]
    } else if (
      account?.requested === false
      && !(hasOpenOrders && apiRequested && Array.isArray(account.items) && account.items.length > 0)
    ) {
      return
    } else if (hasOpenOrders && apiRequested) {
      accounts[tableId] = { ...accounts[tableId], requested: true }
    } else if (apiRequested) {
      accounts[tableId] = { ...account, requested: false, attendedBy: null, attendedAt: null }
    }
  })

  return { ...data, accounts }
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
