export const STORAGE_KEY = 'lumbre-pos-v1'

const today = () => new Date().toISOString().slice(0, 10)

export function createInitialData() {
  return {
    products: [
      { id: 'p-1', name: 'Tostadas de atún', description: 'Atún fresco, aguacate, poro crujiente y salsa de chile serrano.', price: 185, category: 'Entradas', area: 'cocina', active: true, emoji: '🍣', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-2', name: 'Guacamole de la casa', description: 'Aguacate martajado, pico de gallo y totopos recién hechos.', price: 145, category: 'Entradas', area: 'cocina', active: true, emoji: '🥑', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-3', name: 'Pasta al limón', description: 'Pasta fresca, crema ligera, limón amarillo y parmesano.', price: 235, category: 'Platillos', area: 'cocina', active: true, emoji: '🍝', image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-4', name: 'Tacos de arrachera', description: 'Tres tacos con arrachera marinada, cebolla y salsa tatemada.', price: 265, category: 'Platillos', area: 'cocina', active: true, emoji: '🌮', image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-5', name: 'Hamburguesa Lumbre', description: 'Res a la parrilla, queso chihuahua, cebolla caramelizada y papas.', price: 285, category: 'Platillos', area: 'cocina', active: true, emoji: '🍔', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-6', name: 'Limonada mineral', description: 'Limón natural, agua mineral y un toque de hierbabuena.', price: 68, category: 'Bebidas', area: 'barra', active: true, emoji: '🍋', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-7', name: 'Agua de jamaica', description: 'Infusión de jamaica preparada al momento.', price: 52, category: 'Bebidas', area: 'barra', active: true, emoji: '🥤', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=85' },
      { id: 'p-8', name: 'Pastel de chocolate', description: 'Bizcocho húmedo de cacao, ganache y frutos rojos.', price: 125, category: 'Postres', area: 'cocina', active: true, emoji: '🍰', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85' },
    ],
    tables: Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      name: String(index + 1).padStart(2, '0'),
      capacity: index < 4 ? 2 : 4,
      active: true,
    })),
    users: [
      { id: 'u-manager', name: 'Mariana Hernández', username: 'gerente', password: 'Lumbre2026', role: 'gerente', active: true },
      { id: 'u-cook', name: 'Diego Ramírez', username: 'cocina', password: 'Lumbre2026', role: 'cocinero', area: 'cocina', active: true },
      { id: 'u-bar', name: 'Sofía Torres', username: 'barra', password: 'Lumbre2026', role: 'cocinero', area: 'barra', active: true },
      { id: 'u-server', name: 'Alex Cruz', username: 'mesero', password: 'Lumbre2026', role: 'mesero', active: true },
      { id: 'u-cashier', name: 'Luis Flores', username: 'cajero', password: 'Lumbre2026', role: 'cajero', active: true },
      { id: 'u-admin', name: 'Red del restaurante', username: 'adminred', password: 'Lumbre2026', role: 'adminred', active: true },
    ],
    devices: [
      { id: 'TAB-01', type: 'Tablero de mesa', tableId: '1', online: true, lastSeen: new Date().toISOString(), active: true },
      { id: 'TAB-04', type: 'Tablero de mesa', tableId: '4', online: true, lastSeen: new Date().toISOString(), active: true },
      { id: 'COC-01', type: 'Pantalla de cocina', tableId: '', online: true, lastSeen: new Date().toISOString(), active: true },
      { id: 'BAR-01', type: 'Pantalla de barra', tableId: '', online: true, lastSeen: new Date().toISOString(), active: true },
    ],
    orders: [],
    accounts: {},
    sales: [],
    events: [
      { id: 'ev-start', time: new Date().toISOString(), type: 'Sistema', actor: 'Sistema', description: 'Sistema listo para operar.' },
    ],
  }
}

export function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return createInitialData()
    const parsed = JSON.parse(saved)
    const initial = createInitialData()
    return {
      ...initial,
      ...parsed,
      products: Array.isArray(parsed.products) ? parsed.products : initial.products,
      tables: Array.isArray(parsed.tables) ? parsed.tables : initial.tables,
      users: Array.isArray(parsed.users) ? parsed.users : initial.users,
      devices: Array.isArray(parsed.devices) ? parsed.devices : initial.devices,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
    }
  } catch (error) {
    console.error('No fue posible leer los datos guardados.', error)
    return createInitialData()
  }
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
  return new Date(value).toISOString().slice(0, 10)
}

export const todayKey = today
