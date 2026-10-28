import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STORAGE_KEY,
  dateKey,
  loadData,
  money,
  tableOrders,
  tableStatus,
  tableTotal,
  todayKey,
  withEvent,
} from './store'
import './App.css'

const roles = {
  gerente: { label: 'Gerencia', title: 'Panel administrativo', initials: 'G' },
  cocinero: { label: 'Cocina y barra', title: 'Área de preparación', initials: 'C' },
  mesero: { label: 'Servicio', title: 'Atención de mesas', initials: 'S' },
  cajero: { label: 'Caja', title: 'Cobro de cuentas', initials: '$' },
  adminred: { label: 'Administrador de red', title: 'Administración técnica', initials: 'R' },
}

const roleNavigation = {
  gerente: [
    ['overview', 'Resumen', '01'],
    ['orders', 'Pedidos', '02'],
    ['menu', 'Menú', '03'],
    ['tables', 'Mesas', '04'],
    ['users', 'Personal', '05'],
    ['reports', 'Reportes', '06'],
  ],
  cocinero: [
    ['overview', 'Resumen', '01'],
    ['pending', 'Preparación', '02'],
    ['served', 'Pedidos listos', '03'],
  ],
  mesero: [
    ['overview', 'Resumen', '01'],
    ['tables', 'Estado de mesas', '02'],
    ['ready', 'Pedidos listos', '03'],
    ['accounts', 'Solicitudes de cuenta', '04'],
  ],
  cajero: [
    ['overview', 'Resumen', '01'],
    ['accounts', 'Cuentas por cobrar', '02'],
    ['sales', 'Corte de caja', '03'],
  ],
  adminred: [
    ['overview', 'Resumen', '01'],
    ['monitor', 'Monitoreo', '02'],
    ['devices', 'Dispositivos', '03'],
    ['backups', 'Respaldos', '04'],
    ['logs', 'Bitácora', '05'],
  ],
}

const demoAccounts = [
  ['gerente', 'gerente'],
  ['cocina', 'cocinero'],
  ['mesero', 'mesero'],
  ['cajero', 'cajero'],
  ['adminred', 'adminred'],
]

const categories = ['Entradas', 'Platillos', 'Bebidas', 'Postres']
const fallbackFoodImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#e8e8df"/><circle cx="300" cy="200" r="122" fill="#f8f7f0"/><circle cx="300" cy="200" r="92" fill="#d8dfce"/><circle cx="300" cy="200" r="59" fill="#a6b293"/><path d="M210 205c30-54 68-50 93-8 28-41 70-31 87 8-39 57-130 68-180 0Z" fill="#70805e"/><circle cx="273" cy="177" r="9" fill="#c07b50"/><circle cx="332" cy="222" r="8" fill="#c07b50"/><text x="300" y="355" text-anchor="middle" fill="#6e7964" font-family="Arial,sans-serif" font-size="19" letter-spacing="5">LUMBRE</text></svg>')}`

function handleImageError(event) {
  if (event.currentTarget.dataset.fallback) return
  event.currentTarget.dataset.fallback = 'true'
  event.currentTarget.src = fallbackFoodImage
}

function shortTime(value) {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function longDate(value = new Date()) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(value)
}

function App() {
  const [data, setData] = useState(loadData)
  const [session, setSession] = useState(null)
  const [section, setSection] = useState('menu')
  const [tableId, setTableId] = useState('4')
  const [category, setCategory] = useState('Todos')
  const [cart, setCart] = useState({})
  const [toast, setToast] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [payment, setPayment] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [cashReceived, setCashReceived] = useState('')
  const [reportStart, setReportStart] = useState(todayKey())
  const [reportEnd, setReportEnd] = useState(todayKey())
  const [saleDate, setSaleDate] = useState(todayKey())
  const [logType, setLogType] = useState('Todos')
  const fileInput = useRef(null)+

  useEffect(() => {
    // Asegúrate de que el puerto (8080) y el nombre del proyecto (LumbreBackend) coincidan con los de tu Tomcat
    fetch('http://localhost:8080/LumbreBackend/api/menu')
      .then((response) => {
        if (!response.ok) throw new Error('Error al conectar con el servidor');
        return response.json();
      })
      .then((menuData) => {
        console.log('Menú cargado desde MySQL:', menuData);
        
        // Actualizamos el estado global reemplazando los productos locales por los de la BD
        setData((currentData) => ({
          ...currentData,
          products: menuData
        }));
      })
      .catch((error) => {
        console.error('Error obteniendo el menú:', error);
        // Opcional: podrías usar tu función notify() aquí si falla la conexión
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('No fue posible guardar los cambios en este navegador.', error)
    }
  }, [data])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setData(JSON.parse(event.newValue))
        } catch (error) {
          console.error('No fue posible sincronizar los cambios de otra pestaña.', error)
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), [])
  const actor = session?.name || 'Comensal'

  const changeData = (mutate, type, description) => {
    setData((current) => withEvent(mutate(current), type, actor, description))
  }

  const login = (event, credentials) => {
    event.preventDefault()
    const username = credentials.username.trim().toLowerCase()
    const user = data.users.find((candidate) => candidate.username.toLowerCase() === username && candidate.role === credentials.role)
    if (!username || !credentials.password) {
      notify('Completa todos los campos.', 'error')
      return
    }
    if (!user || !user.active || user.password !== credentials.password) {
      setData((current) => withEvent(current, 'Acceso', username, 'Intento fallido de inicio de sesión.'))
      notify('Usuario o contraseña incorrectos.', 'error')
      return
    }
    setSession(user)
    setSection('overview')
    setLoginOpen(false)
    notify(`Bienvenido/a, ${user.name}.`)
    setData((current) => withEvent(current, 'Acceso', user.name, 'Inicio de sesión exitoso.'))
  }

  const logout = () => {
    setData((current) => withEvent(current, 'Acceso', actor, 'Cierre de sesión.'))
    setSession(null)
    setSection('menu')
    setCart({})
    notify('Sesión cerrada correctamente.')
  }

  const addToCart = (product) => {
    setCart((current) => ({
      ...current,
      [product.id]: {
        productId: product.id,
        quantity: (current[product.id]?.quantity || 0) + 1,
        comments: current[product.id]?.comments || '',
      },
    }))
    notify(`${product.name} se agregó a tu pedido.`)
  }

  const updateCartItem = (productId, values) => {
    setCart((current) => {
      const existing = current[productId]
      if (!existing) return current
      if (values.quantity <= 0) {
        const updated = { ...current }
        delete updated[productId]
        return updated
      }
      return { ...current, [productId]: { ...existing, ...values } }
    })
  }

  const sendOrder = () => {
    const items = Object.values(cart)
      .map((cartItem) => {
        const product = data.products.find((candidate) => candidate.id === cartItem.productId && candidate.active)
        return product ? { ...cartItem, name: product.name, price: Number(product.price), area: product.area } : null
      })
      .filter(Boolean)
    if (!items.length) {
      notify('Agrega al menos un producto.', 'error')
      return
    }
    if (data.accounts[tableId]?.requested) {
      notify('Tu cuenta ya fue solicitada. Pide apoyo al personal para agregar algo más.', 'error')
      return
    }
    const createdAt = new Date().toISOString()
    const grouped = Object.groupBy ? Object.groupBy(items, (item) => item.area) : items.reduce((groups, item) => {
      groups[item.area] = [...(groups[item.area] || []), item]
      return groups
    }, {})
    const newOrders = Object.entries(grouped).map(([area, orderItems]) => ({
      id: `PED-${Date.now().toString().slice(-6)}-${area === 'barra' ? 'B' : 'C'}`,
      tableId,
      area,
      items: orderItems,
      status: 'Pendiente',
      createdAt,
      paid: false,
    }))
    changeData((current) => ({
      ...current,
      orders: [...current.orders, ...newOrders],
      accounts: { ...current.accounts, [tableId]: { ...current.accounts[tableId], requested: false } },
    }), 'Pedido', `Nuevo pedido de la mesa ${tableId.padStart(2, '0')}.`)
    setCart({})
    notify('Tu pedido se envió correctamente.')
    setSection('account')
  }

  const requestAccount = (method) => {
    if (!tableOrders(data, tableId).length) {
      notify('No tienes pedidos para solicitar la cuenta.', 'error')
      return
    }
    changeData((current) => ({
      ...current,
      accounts: {
        ...current.accounts,
        [tableId]: { requested: true, method, requestedAt: new Date().toISOString(), attendedBy: null },
      },
    }), 'Cuenta', `La mesa ${tableId.padStart(2, '0')} solicitó la cuenta (${method.toLowerCase()}).`)
    notify('Tu cuenta fue solicitada, en un momento se acercará el personal.')
  }

  const billTotal = tableTotal(data, tableId)
  const cartItems = Object.values(cart)
  const cartTotal = cartItems.reduce((total, item) => {
    const product = data.products.find((candidate) => candidate.id === item.productId)
    return total + (product?.price || 0) * item.quantity
  }, 0)

  const currentNav = roleNavigation[session?.role] || []
  const displayName = session?.name || 'Invitado'

  return (
    <div className={session ? 'app-layout staff-layout' : 'app-layout guest-layout'}>
      {session ? (
        <aside className="sidebar">
          <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); setSection('overview') }}>
            <span className="brand-mark">L</span>
            <span className="brand-copy"><strong>lumbre</strong><small>RESTAURANTE</small></span>
          </a>
          <div className="workspace-label">ESPACIO DE TRABAJO</div>
          <div className="staff-profile">
            <span className={`avatar avatar-${session.role}`}>{roles[session.role]?.initials}</span>
            <span className="staff-profile-copy"><strong>{displayName}</strong><small>{roles[session.role]?.label}</small></span>
            <span className="online-dot" aria-label="Sesión activa" />
          </div>
          <nav className="side-navigation" aria-label="Navegación principal">
            {currentNav.map(([id, label, number]) => (
              <button className={`nav-item ${section === id ? 'selected' : ''}`} key={id} onClick={() => setSection(id)}>
                <span className="nav-number">{number}</span><span>{label}</span>
                {id === 'accounts' && data.accounts && Object.values(data.accounts).filter((account) => account.requested).length > 0 && session.role !== 'cajero' ? <span className="nav-alert" /> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="service-status"><span className="online-dot" /><span>Servicio operativo</span></div>
            <button className="nav-item guest-link" onClick={logout}><span className="nav-number">↗</span><span>Cerrar sesión</span></button>
            <div className="sidebar-footer">Lumbre POS <span>v1.0</span></div>
          </div>
        </aside>
      ) : null}

      <div className="main-column">
        <header className="topbar">
          {!session ? (
            <>
              <a className="brand guest-brand" href="#inicio" onClick={(event) => { event.preventDefault(); setSection('menu') }}>
                <span className="brand-mark">L</span><span className="brand-copy"><strong>lumbre</strong><small>COCINA DE TEMPORADA</small></span>
              </a>
              <div className="guest-top-actions">
                <label className="table-picker"><span>MESA</span>
                  <select value={tableId} onChange={(event) => setTableId(event.target.value)} aria-label="Seleccionar mesa">
                    {data.tables.filter((table) => table.active).map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
                  </select>
                </label>
                <button className="button button-quiet staff-login-button" onClick={() => setLoginOpen(true)}>Acceso de personal <span>↗</span></button>
              </div>
            </>
          ) : (
            <>
              <div className="breadcrumb"><span>RESTAURANTE LUMBRE</span><span className="breadcrumb-divider">/</span><strong>{currentNav.find(([id]) => id === section)?.[1] || roles[session.role]?.title}</strong></div>
              <div className="topbar-right"><span className="date-label">{longDate()}</span><button className="top-avatar" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}>{session.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</button></div>
            </>
          )}
        </header>

        {!session ? (
          <nav className="guest-nav" aria-label="Navegación de la mesa">
            <button className={section === 'menu' ? 'guest-nav-active' : ''} onClick={() => setSection('menu')}>El menú</button>
            <button className={section === 'order' ? 'guest-nav-active' : ''} onClick={() => setSection('order')}>Mi pedido{cartItems.length ? <span className="cart-count">{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</span> : null}</button>
            <button className={section === 'account' ? 'guest-nav-active' : ''} onClick={() => setSection('account')}>Mi cuenta</button>
          </nav>
        ) : null}

        <main className={`content ${session ? 'staff-content' : 'guest-content'}`}>
          {!session && section === 'menu' ? (
            <GuestMenu
              data={data}
              category={category}
              setCategory={setCategory}
              tableId={tableId}
              onAdd={addToCart}
              cart={cart}
              onGoToOrder={() => setSection('order')}
            />
          ) : null}
          {!session && section === 'order' ? (
            <GuestOrder
              data={data}
              cart={cart}
              tableId={tableId}
              cartTotal={cartTotal}
              updateCartItem={updateCartItem}
              sendOrder={sendOrder}
              onBrowse={() => setSection('menu')}
            />
          ) : null}
          {!session && section === 'account' ? (
            <GuestAccount
              data={data}
              tableId={tableId}
              billTotal={billTotal}
              requestAccount={requestAccount}
              onBrowse={() => setSection('menu')}
            />
          ) : null}
          {session?.role === 'gerente' && section === 'overview' ? <ManagerOverview data={data} setSection={setSection} /> : null}
          {session?.role === 'gerente' && section === 'menu' ? <ManagerMenu data={data} changeData={changeData} notify={notify} setModal={setModal} /> : null}
          {session?.role === 'gerente' && section === 'tables' ? <ManagerTables data={data} changeData={changeData} notify={notify} setModal={setModal} /> : null}
          {session?.role === 'gerente' && section === 'users' ? <ManagerUsers data={data} changeData={changeData} notify={notify} setModal={setModal} /> : null}
          {session?.role === 'gerente' && section === 'orders' ? <ManagerOrders data={data} /> : null}
          {session?.role === 'gerente' && section === 'reports' ? (
            <SalesReport data={data} start={reportStart} end={reportEnd} setStart={setReportStart} setEnd={setReportEnd} />
          ) : null}
          {session?.role === 'cocinero' && section === 'overview' ? <CookOverview data={data} session={session} setSection={setSection} /> : null}
          {session?.role === 'cocinero' && section === 'pending' ? <CookOrders data={data} session={session} changeData={changeData} notify={notify} /> : null}
          {session?.role === 'cocinero' && section === 'served' ? <CookHistory data={data} session={session} /> : null}
          {session?.role === 'mesero' && section === 'overview' ? <WaiterOverview data={data} setSection={setSection} /> : null}
          {session?.role === 'mesero' && section === 'tables' ? <WaiterTables data={data} /> : null}
          {session?.role === 'mesero' && section === 'ready' ? <ReadyOrders data={data} changeData={changeData} notify={notify} /> : null}
          {session?.role === 'mesero' && section === 'accounts' ? <WaiterAccounts data={data} changeData={changeData} notify={notify} actor={actor} /> : null}
          {session?.role === 'cajero' && section === 'overview' ? <CashierOverview data={data} setSection={setSection} onCollect={(id) => { setPayment(id); setPaymentMethod(data.accounts[id]?.method || 'Efectivo'); setCashReceived('') }} /> : null}
          {session?.role === 'cajero' && section === 'accounts' ? <CashierAccounts data={data} onCollect={(id) => { setPayment(id); setPaymentMethod(data.accounts[id]?.method || 'Efectivo'); setCashReceived('') }} /> : null}
          {session?.role === 'cajero' && section === 'sales' ? <CashierSales data={data} date={saleDate} setDate={setSaleDate} session={session} /> : null}
          {session?.role === 'adminred' && section === 'overview' ? <NetworkOverview data={data} setSection={setSection} /> : null}
          {session?.role === 'adminred' && section === 'monitor' ? <NetworkMonitor data={data} /> : null}
          {session?.role === 'adminred' && section === 'devices' ? <NetworkDevices data={data} changeData={changeData} notify={notify} /> : null}
          {session?.role === 'adminred' && section === 'backups' ? <Backups data={data} setData={setData} changeData={changeData} notify={notify} fileInput={fileInput} /> : null}
          {session?.role === 'adminred' && section === 'logs' ? <EventLog data={data} logType={logType} setLogType={setLogType} /> : null}
        </main>
      </div>

      {loginOpen ? <LoginModal onLogin={login} onClose={() => setLoginOpen(false)} /> : null}
      {modal?.type === 'product' ? <ProductModal product={modal.product} data={data} onSave={(product) => saveProduct(product, data, changeData, notify, setModal)} onClose={() => setModal(null)} /> : null}
      {modal?.type === 'table' ? <TableModal table={modal.table} onSave={(table) => saveTable(table, data, changeData, notify, setModal)} onClose={() => setModal(null)} /> : null}
      {modal?.type === 'user' ? <UserModal user={modal.user} onSave={(user) => saveUser(user, data, changeData, notify, setModal)} onClose={() => setModal(null)} /> : null}
      {payment ? (
        <PaymentModal
          data={data}
          tableId={payment}
          method={paymentMethod}
          setMethod={setPaymentMethod}
          received={cashReceived}
          setReceived={setCashReceived}
          onClose={() => setPayment(null)}
          onConfirm={() => confirmPayment(payment, paymentMethod, cashReceived, session, data, changeData, notify, setPayment)}
        />
      ) : null}
      {toast ? <div className={`toast-message toast-${toast.type}`} role="status" aria-live="polite"><span>{toast.type === 'error' ? '!' : '✓'}</span>{toast.message}<button onClick={() => setToast(null)} aria-label="Cerrar aviso">×</button></div> : null}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description ? <p className="page-description">{description}</p> : null}</div>
      {action ? <div className="page-heading-action">{action}</div> : null}
    </div>
  )
}

function StatCard({ label, value, note, accent = false }) {
  return <article className={`stat-card ${accent ? 'stat-accent' : ''}`}><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-note">{note}</span></article>
}

function EmptyState({ title, description, action }) {
  return <div className="empty-state"><span className="empty-mark">—</span><h3>{title}</h3>{description ? <p>{description}</p> : null}{action || null}</div>
}

function GuestMenu({ data, category, setCategory, tableId, onAdd, cart, onGoToOrder }) {
  const [selectedProduct, setSelectedProduct] = useState(null)
  const availableCategories = ['Todos', ...new Set(data.products.filter((product) => product.active).map((product) => product.category))]
  const products = data.products.filter((product) => product.active && (category === 'Todos' || product.category === category))
  const count = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)
  return (
    <>
      <section className="guest-hero">
        <div className="hero-copy"><span className="hero-kicker"><span /> COCINA HONESTA · INGREDIENTES LOCALES</span><h1>Qué gusto<br />tenerte aquí.</h1><p>Sabores de temporada, preparados al momento y para compartir.</p><div className="hero-meta"><span>MESA {String(tableId).padStart(2, '0')}</span><span>·</span><span>MENÚ DEL DÍA</span></div></div>
        <div className="hero-image"><img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=90" alt="Mesa preparada en el restaurante" /><span className="hero-image-label">HECHO CON CALMA, SERVIDO CON CARIÑO</span></div>
      </section>
      <section className="guest-menu-section">
        <div className="menu-section-heading"><div><p className="eyebrow">ALGO RICO TE ESPERA</p><h2>Explora el menú</h2></div><button className="text-button" onClick={onGoToOrder}>Ver mi pedido <span>→</span></button></div>
        <div className="category-tabs" role="tablist" aria-label="Categorías del menú">
          {availableCategories.map((item) => <button key={item} className={category === item ? 'category-active' : ''} onClick={() => setCategory(item)}>{item}<span>{item === 'Todos' ? data.products.filter((product) => product.active).length : data.products.filter((product) => product.active && product.category === item).length}</span></button>)}
        </div>
        {products.length ? <div className="product-grid">{products.map((product) => (
          <article className="product-card" key={product.id}>
            <button className="product-photo" onClick={() => setSelectedProduct(product)} aria-label={`Ver detalle de ${product.name}`}><img src={product.image || fallbackFoodImage} onError={handleImageError} alt={product.name} /><span className="product-category">{product.category}</span></button>
            <div className="product-info"><button className="product-name" onClick={() => setSelectedProduct(product)}>{product.name}</button><p>{product.description}</p><div className="product-bottom"><strong>{money(product.price)}</strong><button className="add-button" onClick={() => onAdd(product)} aria-label={`Agregar ${product.name}`}><span>+</span> Agregar</button></div></div>
          </article>
        ))}</div> : <EmptyState title="No hay productos disponibles en esta categoría" />}
      </section>
      {count ? <button className="floating-order" onClick={onGoToOrder}><span>Tu pedido</span><span>{count} {count === 1 ? 'artículo' : 'artículos'}</span><strong>Ver pedido →</strong></button> : null}
      {selectedProduct ? <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}><div className="modal product-detail-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Cerrar">×</button><img src={selectedProduct.image || fallbackFoodImage} onError={handleImageError} alt={selectedProduct.name} /><div className="modal-body"><span className="eyebrow">{selectedProduct.category} · {selectedProduct.area === 'barra' ? 'BARRA' : 'COCINA'}</span><h2>{selectedProduct.name}</h2><p>{selectedProduct.description}</p><div className="modal-footer"><strong>{money(selectedProduct.price)}</strong><button className="button button-dark" onClick={() => { onAdd(selectedProduct); setSelectedProduct(null) }}>Agregar al pedido</button></div></div></div></div> : null}
    </>
  )
}

function GuestOrder({ data, cart, tableId, cartTotal, updateCartItem, sendOrder, onBrowse }) {
  const items = Object.values(cart)
  return (
    <section className="guest-narrow">
      <PageHeading eyebrow={`MESA ${String(tableId).padStart(2, '0')} · TU PEDIDO`} title="Lo que vamos a preparar" description="Revisa tu selección y agrega alguna indicación para cocina." />
      {items.length ? (
        <>
          <div className="cart-list">{items.map((item) => {
            const product = data.products.find((candidate) => candidate.id === item.productId)
            if (!product) return null
            return <article className="cart-item" key={product.id}><img src={product.image || fallbackFoodImage} onError={handleImageError} alt="" /><div className="cart-item-info"><strong>{product.name}</strong><span>{money(product.price)} · {product.area === 'barra' ? 'Barra' : 'Cocina'}</span><label className="comment-input">Nota para cocina <input value={item.comments} onChange={(event) => updateCartItem(product.id, { comments: event.target.value })} placeholder="Sin cebolla, por favor…" maxLength={120} /></label></div><div className="cart-item-end"><strong>{money(product.price * item.quantity)}</strong><div className="quantity-control"><button onClick={() => updateCartItem(product.id, { quantity: item.quantity - 1 })} aria-label="Quitar una unidad">−</button><span>{item.quantity}</span><button onClick={() => updateCartItem(product.id, { quantity: item.quantity + 1 })} aria-label="Agregar una unidad">+</button></div><button className="remove-link" onClick={() => updateCartItem(product.id, { quantity: 0 })}>Quitar</button></div></article>
          })}</div>
          <div className="cart-summary"><div><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><p>Los precios incluyen IVA. El pago se realiza al finalizar tu visita.</p><button className="button button-dark button-wide" onClick={sendOrder}>Enviar pedido a cocina <span>→</span></button><button className="text-button center-button" onClick={onBrowse}>Seguir explorando el menú</button></div>
        </>
      ) : <EmptyState title="Tu pedido está vacío" description="Explora el menú y agrega algo delicioso." action={<button className="button button-dark" onClick={onBrowse}>Explorar el menú</button>} />}
    </section>
  )
}

function GuestAccount({ data, tableId, billTotal, requestAccount, onBrowse }) {
  const orders = tableOrders(data, tableId).sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
  const account = data.accounts[tableId]
  const [method, setMethod] = useState('Efectivo')
  return (
    <section className="guest-narrow">
      <PageHeading eyebrow={`MESA ${String(tableId).padStart(2, '0')} · TU VISITA`} title="Tu cuenta" description="El consumo de tu mesa se actualiza con cada pedido enviado." />
      {orders.length ? (
        <>
          <div className="account-lines">{orders.map((order) => (
            <div className="account-order" key={order.id}><div className="account-order-heading"><span>{order.id}</span><span>{shortTime(order.createdAt)} · {order.area === 'barra' ? 'Barra' : 'Cocina'}</span><StatusBadge status={order.status} /></div>{order.items.map((item) => <div className="account-line" key={item.productId}><span>{item.quantity} × {item.name}</span><span>{money(item.price * item.quantity)}</span></div>)}</div>
          ))}</div>
          <div className="account-total"><span>Total de tu cuenta</span><strong>{money(billTotal)}</strong></div>
          {account?.requested ? <div className="account-requested"><span className="online-dot" /><div><strong>Tu cuenta ya está solicitada</strong><p>El personal se acercará a tu mesa. Método elegido: {account.method}.</p></div></div> : (
            <div className="request-card"><p className="eyebrow">¿LISTO PARA CERRAR TU CUENTA?</p><h3>Solicita tu cuenta</h3><p>Elige cómo prefieres pagar. El cobro se realiza directamente con nuestro equipo.</p><div className="payment-options">{['Efectivo', 'Tarjeta'].map((option) => <button key={option} className={method === option ? 'payment-option selected' : 'payment-option'} onClick={() => setMethod(option)}><span className="radio-dot" />{option}<small>{option === 'Efectivo' ? 'Paga en efectivo en caja' : 'Paga con terminal en caja'}</small></button>)}</div><button className="button button-dark button-wide" onClick={() => requestAccount(method)}>Solicitar cuenta <span>→</span></button></div>
          )}
          <p className="account-footnote">El total incluye todos los pedidos enviados durante tu visita.</p>
        </>
      ) : <EmptyState title="Aún no tienes pedidos registrados" description="Cuando envíes tu primer pedido, aquí podrás consultar tu cuenta." action={<button className="button button-dark" onClick={onBrowse}>Ver el menú</button>} />}
    </section>
  )
}

function LoginModal({ onLogin, onClose }) {
  const [role, setRole] = useState('gerente')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const fillDemo = (account, accountRole) => {
    setRole(accountRole)
    setUsername(account)
    setPassword('Lumbre2026')
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="modal login-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><div className="login-brand"><span className="brand-mark">L</span><span className="eyebrow">SISTEMA DE OPERACIÓN</span></div><h2>Bienvenido al equipo.</h2><p className="login-intro">Ingresa con las credenciales asignadas por gerencia.</p>
    <form onSubmit={(event) => onLogin(event, { role, username, password })}><label className="form-field">Área de trabajo<select value={role} onChange={(event) => setRole(event.target.value)}>{Object.entries(roles).map(([id, item]) => <option value={id} key={id}>{item.label}</option>)}</select></label><label className="form-field">Usuario<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu nombre de usuario" /></label><label className="form-field">Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" /></label><button className="button button-dark button-wide" type="submit">Iniciar sesión <span>→</span></button></form>
    <div className="demo-access"><span>ACCESO DEMOSTRACIÓN</span><div>{demoAccounts.map(([account, accountRole]) => <button key={accountRole} onClick={() => fillDemo(account, accountRole)}>{roles[accountRole].label}</button>)}</div><small>Al elegir un perfil se completa la contraseña de demostración: <strong>Lumbre2026</strong></small></div>
  </div></div>
}

function ManagerOverview({ data, setSection }) {
  const requested = Object.entries(data.accounts).filter(([, account]) => account.requested)
  const occupied = data.tables.filter((table) => table.active && tableStatus(data, table.id) !== 'Libre').length
  const todaySales = data.sales.filter((sale) => dateKey(sale.paidAt) === todayKey())
  const pending = data.orders.filter((order) => !order.paid && order.status !== 'Servido')
  return <><PageHeading eyebrow="MIÉRCOLES · OPERACIÓN DEL RESTAURANTE" title="Buenos días, Mariana." description="Aquí tienes el pulso de Lumbre para hoy." action={<span className="live-pill"><span /> OPERACIÓN EN VIVO</span>} /><div className="stats-grid"><StatCard label="MESAS EN SERVICIO" value={`${occupied} / ${data.tables.filter((table) => table.active).length}`} note="Mesas con cuenta abierta" accent /><StatCard label="PEDIDOS ACTIVOS" value={pending.length} note="En cocina, barra y para servir" /><StatCard label="CUENTAS SOLICITADAS" value={requested.length} note={requested.length ? 'Requieren atención del equipo' : 'Todo al día'} /><StatCard label="VENTA DE HOY" value={money(todaySales.reduce((sum, sale) => sum + sale.total, 0))} note={`${todaySales.length} cuentas pagadas`} /></div>
    <div className="dashboard-grid"><section className="panel"><PanelHeading title="Pedidos en curso" link="Ver todos" onClick={() => setSection('orders')} /><OrderTable orders={pending.slice(0, 5)} tables={data.tables} /></section><section className="panel"><PanelHeading title="Atención pendiente" link="Ver solicitudes" onClick={() => setSection('orders')} />{requested.length ? requested.slice(0, 4).map(([id, account]) => <div className="attention-row" key={id}><span className="table-chip">M{id.padStart(2, '0')}</span><div><strong>Mesa {id.padStart(2, '0')}</strong><small>{shortTime(account.requestedAt)} · {account.method}</small></div><strong>{money(tableTotal(data, id))}</strong></div>) : <EmptyState title="Todo está en orden" description="Las solicitudes de cuenta aparecerán aquí." />}</section></div>
    <div className="quick-actions"><div><p className="eyebrow">ACCESOS RÁPIDOS</p><h2>¿Qué quieres hacer?</h2></div><div className="quick-action-list"><button onClick={() => setSection('menu')}><span>01</span>Administrar menú <b>→</b></button><button onClick={() => setSection('tables')}><span>02</span>Configurar mesas <b>→</b></button><button onClick={() => setSection('reports')}><span>03</span>Ver reportes <b>→</b></button></div></div>
  </>
}

function PanelHeading({ title, link, onClick }) {
  return <div className="panel-heading"><h2>{title}</h2>{link ? <button className="text-button" onClick={onClick}>{link} <span>→</span></button> : null}</div>
}

function OrderTable({ orders, tables }) {
  if (!orders.length) return <EmptyState title="No hay pedidos pendientes" description="Los pedidos de las mesas aparecerán aquí." />
  return <div className="table-scroll"><table><thead><tr><th>PEDIDO</th><th>MESA</th><th>DETALLE</th><th>ÁREA</th><th>ESTADO</th><th>HORA</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className="strong-cell">{order.id}</td><td>Mesa {tables.find((table) => table.id === order.tableId)?.name || order.tableId}</td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} productos</td><td>{order.area === 'barra' ? 'Barra' : 'Cocina'}</td><td><StatusBadge status={order.status} /></td><td>{shortTime(order.createdAt)}</td></tr>)}</tbody></table></div>
}

function StatusBadge({ status }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`status-badge status-${className}`}>{status}</span>
}

function ManagerMenu({ data, changeData, notify, setModal }) {
  const [filter, setFilter] = useState('Todos')
  const products = data.products.filter((product) => filter === 'Todos' || (filter === 'Activos' ? product.active : !product.active))
  return <><PageHeading eyebrow="ADMINISTRACIÓN DEL RESTAURANTE" title="Menú" description="Mantén al día los productos que se sirven en Lumbre." action={<button className="button button-dark" onClick={() => setModal({ type: 'product', product: null })}>＋ Agregar producto</button>} /><div className="list-toolbar"><div className="filter-pills">{['Todos', 'Activos', 'Inactivos'].map((item) => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><span>{products.length} productos</span></div>
    <div className="admin-product-list">{products.map((product) => <article className={`admin-product-row ${!product.active ? 'product-disabled' : ''}`} key={product.id}><img src={product.image || fallbackFoodImage} onError={handleImageError} alt="" /><div className="admin-product-main"><strong>{product.name}</strong><span>{product.category} · {product.area === 'barra' ? 'Barra' : 'Cocina'}</span><small>{product.description || 'Sin descripción'}</small></div><strong className="admin-product-price">{money(product.price)}</strong><StatusBadge status={product.active ? 'Activo' : 'Inactivo'} /><button className="row-action" onClick={() => setModal({ type: 'product', product })}>Editar</button><button className="row-action" onClick={() => { changeData((current) => ({ ...current, products: current.products.map((item) => item.id === product.id ? { ...item, active: !item.active } : item) }), 'Menú', `${product.active ? 'Producto desactivado' : 'Producto activado'}: ${product.name}.`); notify(product.active ? 'Producto desactivado.' : 'Producto activado.') }}>{product.active ? 'Desactivar' : 'Activar'}</button></article>)}</div>
  </>
}

function ManagerTables({ data, changeData, notify, setModal }) {
  const activeTables = data.tables.filter((table) => table.active)
  return <><PageHeading eyebrow="ADMINISTRACIÓN DEL RESTAURANTE" title="Mesas" description="Organiza las mesas y consulta su estado de servicio." action={<button className="button button-dark" onClick={() => setModal({ type: 'table', table: null })}>＋ Agregar mesa</button>} /><div className="table-cards">{activeTables.map((table) => {
    const status = tableStatus(data, table.id)
    return <article className={`table-card ${status === 'Libre' ? '' : 'table-card-busy'}`} key={table.id}><div className="table-card-top"><span className="table-chip">M{table.name}</span><StatusBadge status={status} /></div><div className="table-number">{table.name}</div><span className="table-capacity">Capacidad para {table.capacity} personas</span><div className="table-card-bottom"><span>{money(tableTotal(data, table.id))}</span><button className="row-action" onClick={() => setModal({ type: 'table', table })}>Editar mesa</button><button className="row-action danger-link" onClick={() => {
      if (tableOrders(data, table.id).length) { notify('No se puede desactivar una mesa con cuenta abierta.', 'error'); return }
      changeData((current) => ({ ...current, tables: current.tables.map((item) => item.id === table.id ? { ...item, active: false } : item) }), 'Mesas', `Mesa ${table.name} desactivada.`)
      notify('Mesa desactivada.')
    }}>Desactivar</button></div></article>
  })}</div>{activeTables.length === 0 ? <EmptyState title="No hay mesas activas" description="Agrega una mesa para empezar a recibir pedidos." /> : null}</>
}

function ManagerUsers({ data, changeData, notify, setModal }) {
  const staff = data.users.filter((user) => user.role !== 'gerente' && user.role !== 'adminred')
  return <><PageHeading eyebrow="ADMINISTRACIÓN DEL RESTAURANTE" title="Equipo" description="Administra accesos y áreas de preparación del personal." action={<button className="button button-dark" onClick={() => setModal({ type: 'user', user: null })}>＋ Agregar persona</button>} /><section className="panel staff-panel"><div className="table-scroll"><table><thead><tr><th>PERSONA</th><th>USUARIO</th><th>ROL</th><th>ÁREA</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{staff.map((user) => <tr key={user.id}><td className="strong-cell">{user.name}</td><td>{user.username}</td><td>{roles[user.role]?.label}</td><td>{user.role === 'cocinero' ? user.area === 'barra' ? 'Barra' : 'Cocina' : '—'}</td><td><StatusBadge status={user.active ? 'Activo' : 'Inactivo'} /></td><td><button className="row-action" onClick={() => setModal({ type: 'user', user })}>Editar</button><button className="row-action" onClick={() => { changeData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, active: !item.active } : item) }), 'Personal', `${user.active ? 'Usuario desactivado' : 'Usuario activado'}: ${user.username}.`); notify(user.active ? 'Acceso desactivado.' : 'Acceso activado.') }}>{user.active ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div></section><p className="page-footnote">Las contraseñas de esta versión de demostración se guardan en el navegador. No uses datos reales.</p></>
}

function ManagerOrders({ data }) {
  const [status, setStatus] = useState('Todos')
  const [table, setTable] = useState('Todas')
  const [date, setDate] = useState(todayKey())
  const orders = data.orders.filter((order) => dateKey(order.createdAt) === date && (status === 'Todos' || order.status === status) && (table === 'Todas' || order.tableId === table)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return <><PageHeading eyebrow="ADMINISTRACIÓN DEL RESTAURANTE" title="Pedidos" description="Da seguimiento a cada pedido desde su recepción hasta la entrega." action={<input className="date-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filtrar por fecha" />} /><div className="list-toolbar"><div className="filter-pills">{['Todos', 'Pendiente', 'En preparación', 'Listo', 'Servido'].map((item) => <button key={item} className={status === item ? 'filter-active' : ''} onClick={() => setStatus(item)}>{item}</button>)}</div><select className="filter-select" value={table} onChange={(event) => setTable(event.target.value)}><option>Todas</option>{data.tables.map((item) => <option key={item.id} value={item.id}>Mesa {item.name}</option>)}</select></div><section className="panel"><OrderTable orders={orders} tables={data.tables} /></section></>
}

function CookOverview({ data, session, setSection }) {
  const pending = data.orders.filter((order) => !order.paid && order.area === session.area && order.status !== 'Listo' && order.status !== 'Servido')
  const ready = data.orders.filter((order) => !order.paid && order.area === session.area && order.status === 'Listo')
  return <><PageHeading eyebrow={`ÁREA DE PREPARACIÓN · ${session.area === 'barra' ? 'BARRA' : 'COCINA'}`} title={`Hola, ${session.name.split(' ')[0]}.`} description="Cada plato cuenta. Aquí tienes lo que sigue en tu estación." action={<span className="live-pill"><span /> ACTUALIZACIÓN AUTOMÁTICA</span>} /><div className="stats-grid"><StatCard label="POR PREPARAR" value={pending.length} note="Pedidos en orden de llegada" accent /><StatCard label="LISTOS PARA SERVIR" value={ready.length} note="Esperando al equipo de piso" /><StatCard label="ÁREA ASIGNADA" value={session.area === 'barra' ? 'Barra' : 'Cocina'} note="Pedidos filtrados por estación" /></div><section className="panel dashboard-panel"><PanelHeading title="Siguiente en la fila" link="Abrir preparación" onClick={() => setSection('pending')} /><CookOrderList orders={pending.slice(0, 3)} changeData={() => { }} notify={() => { }} /></section></>
}

function CookOrders({ data, session, changeData, notify }) {
  const [filter, setFilter] = useState('Activos')
  const orders = data.orders.filter((order) => !order.paid && order.area === session.area && (filter === 'Activos' ? order.status === 'Pendiente' || order.status === 'En preparación' : order.status === 'Listo')).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return <><PageHeading eyebrow={`${session.area === 'barra' ? 'BARRA' : 'COCINA'} · PREPARACIÓN`} title="Comandas" description="Prepara los pedidos por orden de llegada y actualiza su avance." action={<span className="live-pill"><span /> EN VIVO</span>} /><div className="list-toolbar"><div className="filter-pills">{['Activos', 'Listos'].map((item) => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><span>{orders.length} {orders.length === 1 ? 'comanda' : 'comandas'}</span></div><CookOrderList orders={orders} changeData={changeData} notify={notify} /></>
}

function CookOrderList({ orders, changeData, notify }) {
  if (!orders.length) return <EmptyState title="No hay pedidos pendientes" description="Las comandas nuevas aparecerán aquí automáticamente." />
  return <div className="kitchen-grid">{orders.map((order) => <article className={`kitchen-ticket ticket-${order.status.toLowerCase().replaceAll(' ', '-')}`} key={order.id}><div className="ticket-header"><span className="table-chip">M{order.tableId.padStart(2, '0')}</span><span className="ticket-time">{shortTime(order.createdAt)}</span><StatusBadge status={order.status} /></div><div className="ticket-id">{order.id}</div><div className="ticket-items">{order.items.map((item) => <div className="ticket-item" key={item.productId}><strong>{item.quantity}<span>×</span></strong><div><b>{item.name}</b>{item.comments ? <small>Nota: {item.comments}</small> : null}</div></div>)}</div>{order.status !== 'Listo' ? <button className="button button-dark button-wide" onClick={() => { const nextStatus = order.status === 'Pendiente' ? 'En preparación' : 'Listo'; changeData((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString(), ...(nextStatus === 'Listo' ? { readyAt: new Date().toISOString() } : {}) } : item) }), 'Pedido', `${order.id} actualizado a ${nextStatus}.`); notify(nextStatus === 'Listo' ? 'Pedido listo. Servicio ya puede entregarlo.' : 'Pedido en preparación.') }}>{order.status === 'Pendiente' ? 'Comenzar preparación' : 'Marcar como listo'} <span>→</span></button> : <div className="ready-confirmation"><span>✓</span> Listo para entregar</div>}</article>)}</div>
}

function CookHistory({ data, session }) {
  const [date, setDate] = useState(todayKey())
  const orders = data.orders.filter((order) => order.area === session.area && (order.status === 'Listo' || order.status === 'Servido') && dateKey(order.readyAt || order.createdAt) === date).sort((a, b) => new Date(b.readyAt || b.createdAt) - new Date(a.readyAt || a.createdAt))
  return <><PageHeading eyebrow={`${session.area === 'barra' ? 'BARRA' : 'COCINA'} · HISTORIAL`} title="Pedidos listos" description="Consulta los pedidos preparados en tu estación." action={<input className="date-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filtrar por fecha" />} />{orders.length ? <div className="history-list">{orders.map((order) => <div className="history-row" key={order.id}><span className="table-chip">M{order.tableId.padStart(2, '0')}</span><div><strong>{order.id}</strong><small>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</small></div><span>Recibido {shortTime(order.createdAt)}</span><span>Listo {shortTime(order.readyAt || order.createdAt)}</span><StatusBadge status={order.status} /></div>)}</div> : <EmptyState title="No hay pedidos atendidos" description="Los pedidos listos de la fecha seleccionada aparecerán aquí." />}</>
}

function WaiterOverview({ data, setSection }) {
  const waiting = data.orders.filter((order) => !order.paid && order.status === 'Listo')
  const requested = Object.entries(data.accounts).filter(([, account]) => account.requested && !account.attendedBy)
  const occupied = data.tables.filter((table) => table.active && tableStatus(data, table.id) !== 'Libre').length
  return <><PageHeading eyebrow="SERVICIO DE MESA" title="Tu turno, en orden." description="Consulta las mesas y atiende lo que necesita cada una." action={<span className="live-pill"><span /> ACTUALIZACIÓN AUTOMÁTICA</span>} /><div className="stats-grid"><StatCard label="MESAS OCUPADAS" value={occupied} note="Con pedidos activos" accent /><StatCard label="PEDIDOS LISTOS" value={waiting.length} note="Para llevar a la mesa" /><StatCard label="CUENTAS POR ATENDER" value={requested.length} note="Solicitudes nuevas" /></div><div className="dashboard-grid"><section className="panel"><PanelHeading title="Pedidos listos para servir" link="Ir a pedidos" onClick={() => setSection('ready')} />{waiting.slice(0, 4).map((order) => <div className="attention-row" key={order.id}><span className="table-chip">M{order.tableId.padStart(2, '0')}</span><div><strong>{order.id}</strong><small>{order.items.reduce((sum, item) => sum + item.quantity, 0)} productos · listo {shortTime(order.readyAt || order.createdAt)}</small></div><StatusBadge status="Listo" /></div>)}{!waiting.length ? <EmptyState title="No hay pedidos listos para servir" /> : null}</section><section className="panel"><PanelHeading title="Solicitudes de cuenta" link="Ver solicitudes" onClick={() => setSection('accounts')} />{requested.slice(0, 4).map(([id, account]) => <div className="attention-row" key={id}><span className="table-chip">M{id.padStart(2, '0')}</span><div><strong>Mesa {id.padStart(2, '0')}</strong><small>{shortTime(account.requestedAt)} · {account.method}</small></div><strong>{money(tableTotal(data, id))}</strong></div>)}{!requested.length ? <EmptyState title="No hay cuentas solicitadas" /> : null}</section></div></>
}

function WaiterTables({ data }) {
  const [filter, setFilter] = useState('Todas')
  const tables = data.tables.filter((table) => table.active && (filter === 'Todas' || tableStatus(data, table.id) === filter))
  return <><PageHeading eyebrow="SERVICIO DE MESA" title="Estado de mesas" description="Consulta la ocupación, el consumo y los pedidos listos para entregar." action={<span className="live-pill"><span /> ACTUALIZADO AHORA</span>} /><div className="list-toolbar"><div className="filter-pills">{['Todas', 'Libre', 'Ocupada', 'Cuenta solicitada'].map((item) => <button className={filter === item ? 'filter-active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><span>{tables.length} mesas</span></div><div className="table-cards">{tables.map((table) => { const status = tableStatus(data, table.id); const readyCount = data.orders.filter((order) => order.tableId === table.id && !order.paid && order.status === 'Listo').length; return <article className={`table-card ${status === 'Libre' ? '' : 'table-card-busy'}`} key={table.id}><div className="table-card-top"><span className="table-chip">M{table.name}</span><StatusBadge status={status} /></div><div className="table-number">{table.name}</div><span className="table-capacity">Capacidad {table.capacity} personas</span><div className="table-card-bottom"><span>{money(tableTotal(data, table.id))}</span>{readyCount ? <span className="ready-count">{readyCount} listo{readyCount > 1 ? 's' : ''} para servir</span> : <span>{readyCount === 0 ? 'Sin pedidos listos' : ''}</span>}</div></article> })}</div>{tables.length === 0 ? <EmptyState title="No hay mesas en este estado" /> : null}</>
}

function ReadyOrders({ data, changeData, notify }) {
  const orders = data.orders.filter((order) => !order.paid && order.status === 'Listo').sort((a, b) => new Date(a.readyAt || a.createdAt) - new Date(b.readyAt || b.createdAt))
  return <><PageHeading eyebrow="SERVICIO DE MESA" title="Listos para servir" description="Confirma la entrega cuando cada pedido llegue a su mesa." action={<span className="live-pill"><span /> EN VIVO</span>} />{orders.length ? <div className="ready-order-list">{orders.map((order) => <article className="ready-order-card" key={order.id}><div className="ready-order-header"><span className="table-chip">M{order.tableId.padStart(2, '0')}</span><div><strong>{order.id}</strong><small>Listo a las {shortTime(order.readyAt || order.createdAt)}</small></div><StatusBadge status="Listo" /></div><div className="ready-items">{order.items.map((item) => <span key={item.productId}>{item.quantity} × {item.name}</span>)}</div><button className="button button-dark" onClick={() => { changeData((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id ? { ...item, status: 'Servido', servedAt: new Date().toISOString() } : item) }), 'Servicio', `${order.id} entregado en la mesa ${order.tableId.padStart(2, '0')}.`); notify('El pedido se marcó como servido.') }}>Confirmar entrega <span>→</span></button></article>)}</div> : <EmptyState title="No hay pedidos listos para servir" description="Cuando cocina o barra termine una comanda, aparecerá aquí." />}</>
}

function WaiterAccounts({ data, changeData, notify, actor }) {
  const requests = Object.entries(data.accounts).filter(([, account]) => account.requested).sort((a, b) => new Date(a[1].requestedAt) - new Date(b[1].requestedAt))
  return <><PageHeading eyebrow="SERVICIO DE MESA" title="Solicitudes de cuenta" description="Confirma que ya estás atendiendo la mesa para habilitar el cobro." action={<span className="live-pill"><span /> EN VIVO</span>} />{requests.length ? <div className="account-request-list">{requests.map(([id, account]) => <article className="account-request-card" key={id}><div className="account-request-top"><span className="table-chip">M{id.padStart(2, '0')}</span><StatusBadge status={account.attendedBy ? 'Atendida' : 'Nueva'} /></div><h2>Mesa {id.padStart(2, '0')}</h2><div className="account-request-facts"><div><span>TOTAL</span><strong>{money(tableTotal(data, id))}</strong></div><div><span>MÉTODO ELEGIDO</span><strong>{account.method}</strong></div><div><span>SOLICITADA</span><strong>{shortTime(account.requestedAt)}</strong></div></div>{account.attendedBy ? <div className="account-requested"><span>✓</span><div><strong>Atendida por {account.attendedBy}</strong><p>La cuenta está disponible para el cajero.</p></div></div> : <button className="button button-dark button-wide" onClick={() => { changeData((current) => ({ ...current, accounts: { ...current.accounts, [id]: { ...current.accounts[id], attendedBy: actor, attendedAt: new Date().toISOString() } } }), 'Servicio', `Solicitud de cuenta de la mesa ${id.padStart(2, '0')} atendida por ${actor}.`); notify('Solicitud de cuenta atendida.') }}>Confirmar que la estoy atendiendo <span>→</span></button>}</article>)}</div> : <EmptyState title="No hay cuentas solicitadas" description="Cuando una mesa pida su cuenta, aparecerá aquí." />}</>
}

function CashierOverview({ data, setSection, onCollect }) {
  const requests = Object.entries(data.accounts).filter(([, account]) => account.requested && account.attendedBy)
  const todaySales = data.sales.filter((sale) => dateKey(sale.paidAt) === todayKey())
  return <><PageHeading eyebrow="PUNTO DE VENTA" title="Caja" description="Cobra las cuentas pendientes y revisa el corte de tu turno." action={<span className="live-pill"><span /> CAJA ABIERTA</span>} /><div className="stats-grid"><StatCard label="POR COBRAR" value={requests.length} note="Cuentas solicitadas" accent /><StatCard label="VENTA DE HOY" value={money(todaySales.reduce((sum, sale) => sum + sale.total, 0))} note={`${todaySales.length} cuentas pagadas`} /><StatCard label="EFECTIVO" value={money(todaySales.filter((sale) => sale.method === 'Efectivo').reduce((sum, sale) => sum + sale.total, 0))} note="Cobros en efectivo" /><StatCard label="TARJETA" value={money(todaySales.filter((sale) => sale.method === 'Tarjeta').reduce((sum, sale) => sum + sale.total, 0))} note="Cobros con terminal" /></div><section className="panel dashboard-panel"><PanelHeading title="Siguiente cuenta" link="Ver todas" onClick={() => setSection('accounts')} />{requests[0] ? <div className="cashier-next"><span className="table-chip">M{requests[0][0].padStart(2, '0')}</span><div><strong>Mesa {requests[0][0].padStart(2, '0')}</strong><small>{requests[0][1].method} · solicitada {shortTime(requests[0][1].requestedAt)}</small></div><strong>{money(tableTotal(data, requests[0][0]))}</strong><button className="button button-dark" onClick={() => onCollect(requests[0][0])}>Cobrar cuenta</button></div> : <EmptyState title="No hay cuentas por cobrar" description="Las cuentas solicitadas por las mesas aparecerán aquí." />}</section><button className="text-button" onClick={() => setSection('sales')}>Consultar corte de caja del turno →</button></>
}

function CashierAccounts({ data, onCollect }) {
  const requests = Object.entries(data.accounts).filter(([, account]) => account.requested && account.attendedBy).sort((a, b) => new Date(a[1].requestedAt) - new Date(b[1].requestedAt))
  return <><PageHeading eyebrow="PUNTO DE VENTA" title="Cuentas por cobrar" description="Revisa el detalle de cada cuenta y registra el pago recibido." action={<span className="live-pill"><span /> ACTUALIZACIÓN AUTOMÁTICA</span>} />{requests.length ? <div className="cashier-account-grid">{requests.map(([id, account]) => <article className="cashier-account-card" key={id}><div className="cashier-account-title"><span className="table-chip">M{id.padStart(2, '0')}</span><div><strong>Mesa {id.padStart(2, '0')}</strong><small>Solicitada {shortTime(account.requestedAt)}</small></div><StatusBadge status="Por cobrar" /></div><div className="cashier-item-list">{tableOrders(data, id).flatMap((order) => order.items.map((item, index) => <div key={`${order.id}-${item.productId}-${index}`}><span>{item.quantity} × {item.name}</span><span>{money(item.price * item.quantity)}</span></div>))}</div><div className="cashier-total"><span>Total de cuenta</span><strong>{money(tableTotal(data, id))}</strong></div><div className="payment-preference">Método elegido por el comensal <strong>{account.method}</strong></div><button className="button button-dark button-wide" onClick={() => onCollect(id)}>Registrar pago <span>→</span></button></article>)}</div> : <EmptyState title="No hay cuentas por cobrar" description="Las cuentas solicitadas por las mesas aparecerán aquí." />}</>
}

function CashierSales({ data, date, setDate, session }) {
  const sales = data.sales.filter((sale) => sale.cashier === session.name && dateKey(sale.paidAt) === date).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
  const cashTotal = sales.filter((sale) => sale.method === 'Efectivo').reduce((sum, sale) => sum + sale.total, 0)
  const cardTotal = sales.filter((sale) => sale.method === 'Tarjeta').reduce((sum, sale) => sum + sale.total, 0)
  return <><PageHeading eyebrow="PUNTO DE VENTA" title="Corte de caja" description="Consulta las ventas que registraste durante el turno." action={<input className="date-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Fecha de ventas" />} /><div className="stats-grid"><StatCard label="CUENTAS COBRADAS" value={sales.length} note={`Fecha ${date}`} accent /><StatCard label="TOTAL COBRADO" value={money(cashTotal + cardTotal)} note="Ventas registradas" /><StatCard label="EFECTIVO" value={money(cashTotal)} note="Pagos en efectivo" /><StatCard label="TARJETA" value={money(cardTotal)} note="Pagos con terminal" /></div>{sales.length ? <section className="panel"><PanelHeading title="Ventas del turno" /><div className="table-scroll"><table><thead><tr><th>HORA</th><th>MESA</th><th>CUENTA</th><th>MÉTODO</th><th>TOTAL</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{shortTime(sale.paidAt)}</td><td>Mesa {sale.tableName}</td><td>{sale.id}</td><td>{sale.method}</td><td className="strong-cell">{money(sale.total)}</td></tr>)}</tbody></table></div></section> : <EmptyState title="No hay ventas registradas" description="Los pagos que registres durante el turno aparecerán aquí." />}</>
}

function SalesReport({ data, start, end, setStart, setEnd }) {
  const validRange = start <= end
  const sales = validRange ? data.sales.filter((sale) => dateKey(sale.paidAt) >= start && dateKey(sale.paidAt) <= end) : []
  const total = sales.reduce((sum, sale) => sum + sale.total, 0)
  const cash = sales.filter((sale) => sale.method === 'Efectivo').reduce((sum, sale) => sum + sale.total, 0)
  const card = sales.filter((sale) => sale.method === 'Tarjeta').reduce((sum, sale) => sum + sale.total, 0)
  const bestSellers = sales.flatMap((sale) => sale.items).reduce((result, item) => {
    result[item.name] = (result[item.name] || 0) + item.quantity
    return result
  }, {})
  const sortedProducts = Object.entries(bestSellers).sort((left, right) => right[1] - left[1]).slice(0, 5)
  return <><PageHeading eyebrow="ADMINISTRACIÓN DEL RESTAURANTE" title="Reportes de venta" description="Consulta las cuentas pagadas en el periodo seleccionado." /><div className="report-filters"><label>Desde<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><span>→</span><label>Hasta<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><span className="report-period">{start} — {end}</span></div>{!validRange ? <div className="inline-error">La fecha final no puede ser anterior a la inicial.</div> : null}{validRange && sales.length ? <><div className="stats-grid"><StatCard label="TOTAL VENDIDO" value={money(total)} note={`${sales.length} cuentas pagadas`} accent /><StatCard label="EFECTIVO" value={money(cash)} note="Pagos en efectivo" /><StatCard label="TARJETA" value={money(card)} note="Pagos con terminal" /><StatCard label="PRODUCTOS VENDIDOS" value={Object.values(bestSellers).reduce((sum, count) => sum + count, 0)} note="Unidades en las cuentas" /></div><div className="dashboard-grid"><section className="panel"><PanelHeading title="Ventas registradas" /><div className="table-scroll"><table><thead><tr><th>FECHA</th><th>MESA</th><th>CAJERO</th><th>MÉTODO</th><th>TOTAL</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sale.paidAt))}</td><td>Mesa {sale.tableName}</td><td>{sale.cashier}</td><td>{sale.method}</td><td className="strong-cell">{money(sale.total)}</td></tr>)}</tbody></table></div></section><section className="panel"><PanelHeading title="Más vendidos" />{sortedProducts.length ? sortedProducts.map(([name, count], index) => <div className="bestseller-row" key={name}><span className="bestseller-rank">0{index + 1}</span><strong>{name}</strong><span>{count} {count === 1 ? 'unidad' : 'unidades'}</span></div>) : <EmptyState title="No hay productos vendidos" />}</section></div></> : validRange ? <EmptyState title="No hay ventas en el periodo seleccionado" description="Prueba con otro rango de fechas." /> : null}</>
}

function NetworkOverview({ data, setSection }) {
  const online = data.devices.filter((device) => device.active && device.online).length
  return <><PageHeading eyebrow="ADMINISTRACIÓN TÉCNICA" title="Estado del sistema" description="Vista rápida de la infraestructura del restaurante." action={<span className="live-pill"><span /> SISTEMA OPERATIVO</span>} /><div className="stats-grid"><StatCard label="SERVIDOR" value="En línea" note="Última comprobación ahora" accent /><StatCard label="BASE DE DATOS" value="Disponible" note="Almacenamiento del navegador" /><StatCard label="DISPOSITIVOS" value={`${online} / ${data.devices.filter((device) => device.active).length}`} note="Dispositivos conectados" /><StatCard label="EVENTOS REGISTRADOS" value={data.events.length} note="Bitácora del sistema" /></div><div className="dashboard-grid"><section className="panel"><PanelHeading title="Conectividad" link="Ver monitoreo" onClick={() => setSection('monitor')} />{data.devices.slice(0, 4).map((device) => <div className="device-row" key={device.id}><span className={device.online ? 'device-indicator' : 'device-indicator offline'} /><div><strong>{device.id}</strong><small>{device.type}{device.tableId ? ` · Mesa ${device.tableId.padStart(2, '0')}` : ''}</small></div><StatusBadge status={device.active && device.online ? 'En línea' : 'Desconectado'} /></div>)}</section><section className="panel"><PanelHeading title="Eventos recientes" link="Consultar bitácora" onClick={() => setSection('logs')} />{data.events.slice(0, 5).map((event) => <div className="log-row" key={event.id}><span className="log-time">{shortTime(event.time)}</span><div><strong>{event.description}</strong><small>{event.type} · {event.actor}</small></div></div>)}</section></div></>
}

function NetworkMonitor({ data }) {
  return <><PageHeading eyebrow="ADMINISTRACIÓN TÉCNICA" title="Monitoreo" description="Estado del servidor, la base de datos y los dispositivos registrados." action={<span className="live-pill"><span /> ACTUALIZADO AHORA</span>} /><div className="monitor-grid"><article className="monitor-card"><span className="monitor-icon">01</span><span className="eyebrow">SERVIDOR</span><h2>En línea</h2><p>Aplicación disponible en este dispositivo.</p><StatusBadge status="En línea" /></article><article className="monitor-card"><span className="monitor-icon">02</span><span className="eyebrow">BASE DE DATOS</span><h2>Disponible</h2><p>Datos locales del navegador.</p><StatusBadge status="En línea" /></article></div><section className="panel"><PanelHeading title="Dispositivos" /><div className="table-scroll"><table><thead><tr><th>IDENTIFICADOR</th><th>TIPO</th><th>MESA ASOCIADA</th><th>ÚLTIMA CONEXIÓN</th><th>ESTADO</th></tr></thead><tbody>{data.devices.map((device) => <tr key={device.id}><td className="strong-cell">{device.id}</td><td>{device.type}</td><td>{device.tableId ? `Mesa ${device.tableId.padStart(2, '0')}` : '—'}</td><td>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(device.lastSeen))}</td><td><StatusBadge status={device.active && device.online ? 'En línea' : 'Desconectado'} /></td></tr>)}</tbody></table></div></section></>
}

function NetworkDevices({ data, changeData, notify }) {
  const [identifier, setIdentifier] = useState('')
  const [type, setType] = useState('Tablero de mesa')
  const [associatedTable, setAssociatedTable] = useState('')
  const addDevice = (event) => {
    event.preventDefault()
    const cleanIdentifier = identifier.trim().toUpperCase()
    if (!cleanIdentifier) { notify('Completa los campos obligatorios.', 'error'); return }
    if (data.devices.some((device) => device.id.toLowerCase() === cleanIdentifier.toLowerCase())) { notify('Este dispositivo ya está registrado.', 'error'); return }
    if (type === 'Tablero de mesa' && !associatedTable) { notify('Selecciona la mesa asociada al tablero.', 'error'); return }
    changeData((current) => ({ ...current, devices: [...current.devices, { id: cleanIdentifier, type, tableId: type === 'Tablero de mesa' ? associatedTable : '', active: true, online: true, lastSeen: new Date().toISOString() }] }), 'Dispositivos', `Dispositivo ${cleanIdentifier} registrado.`)
    setIdentifier('')
    notify('Dispositivo guardado correctamente.')
  }
  return <><PageHeading eyebrow="ADMINISTRACIÓN TÉCNICA" title="Dispositivos" description="Registra y vincula los tableros de mesa y pantallas de preparación." /><section className="panel device-form-panel"><PanelHeading title="Registrar dispositivo" /><form className="inline-device-form" onSubmit={addDevice}><label className="form-field">Identificador<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Ej. TAB-05" required /></label><label className="form-field">Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option>Tablero de mesa</option><option>Pantalla de cocina</option><option>Pantalla de barra</option></select></label>{type === 'Tablero de mesa' ? <label className="form-field">Mesa asociada<select value={associatedTable} onChange={(event) => setAssociatedTable(event.target.value)} required><option value="">Selecciona una mesa</option>{data.tables.filter((table) => table.active).map((table) => <option key={table.id} value={table.id}>Mesa {table.name}</option>)}</select></label> : null}<button className="button button-dark" type="submit">Guardar dispositivo</button></form></section><section className="panel"><PanelHeading title="Dispositivos registrados" /><div className="table-scroll"><table><thead><tr><th>IDENTIFICADOR</th><th>TIPO</th><th>MESA</th><th>ÚLTIMA CONEXIÓN</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>{data.devices.map((device) => <tr key={device.id}><td className="strong-cell">{device.id}</td><td>{device.type}</td><td>{device.tableId ? `Mesa ${device.tableId.padStart(2, '0')}` : '—'}</td><td>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(device.lastSeen))}</td><td><StatusBadge status={device.active && device.online ? 'En línea' : 'Desconectado'} /></td><td><button className="row-action" onClick={() => { changeData((current) => ({ ...current, devices: current.devices.map((item) => item.id === device.id ? { ...item, active: !item.active, online: !item.active } : item) }), 'Dispositivos', `Dispositivo ${device.id} ${device.active ? 'desactivado' : 'activado'}.`); notify(device.active ? 'Dispositivo desactivado.' : 'Dispositivo activado.') }}>{device.active ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div>{!data.devices.length ? <EmptyState title="No hay dispositivos registrados" /> : null}</section></>
}

function Backups({ data, setData, changeData, notify, fileInput }) {
  const [schedule, setSchedule] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lumbre-pos-backup-schedule') || 'null') || { enabled: false, frequency: 'semanal', lastRun: null }
    } catch (error) {
      console.error('No fue posible leer la programación de respaldos.', error)
      return { enabled: false, frequency: 'semanal', lastRun: null }
    }
  })
  const [backups, setBackups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lumbre-pos-backups') || '[]')
    } catch (error) {
      console.error('No fue posible leer los respaldos guardados.', error)
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('lumbre-pos-backup-schedule', JSON.stringify(schedule))
    } catch (error) {
      console.error('No fue posible guardar la programación de respaldos.', error)
      notify('No se pudo guardar la programación de respaldos.', 'error')
    }
  }, [schedule, notify])
  useEffect(() => {
    const runScheduledBackup = () => {
      if (!schedule.enabled) return
      let latestSchedule = schedule
      try {
        const storedSchedule = JSON.parse(localStorage.getItem('lumbre-pos-backup-schedule') || 'null')
        if (storedSchedule?.lastRun && storedSchedule.lastRun !== schedule.lastRun) latestSchedule = storedSchedule
      } catch (error) {
        console.error('No fue posible verificar la programación de respaldos.', error)
        notify('No se pudo verificar la programación de respaldos.', 'error')
        return
      }
      const interval = latestSchedule.frequency === 'diario' ? 86_400_000 : 604_800_000
      if (latestSchedule.lastRun && Date.now() - new Date(latestSchedule.lastRun).getTime() < interval) return
      const backup = { id: `RESP-${Date.now()}`, createdAt: new Date().toISOString(), data }
      const nextBackups = [backup, ...backups].slice(0, 10)
      const nextSchedule = { ...latestSchedule, lastRun: backup.createdAt }
      try {
        localStorage.setItem('lumbre-pos-backups', JSON.stringify(nextBackups))
        localStorage.setItem('lumbre-pos-backup-schedule', JSON.stringify(nextSchedule))
      } catch (error) {
        console.error('No fue posible generar el respaldo programado.', error)
        notify('No se pudo completar la operación.', 'error')
        return
      }
      setBackups(nextBackups)
      setSchedule(nextSchedule)
      setData((current) => withEvent(current, 'Respaldo', 'Administrador de red', 'Respaldo programado generado correctamente.'))
      notify('Respaldo programado generado correctamente.')
    }
    runScheduledBackup()
    const timer = window.setInterval(runScheduledBackup, 60_000)
    return () => window.clearInterval(timer)
  }, [schedule, data, backups, notify, setData])
  const createBackup = () => {
    const backup = { id: `RESP-${Date.now()}`, createdAt: new Date().toISOString(), data }
    const nextBackups = [backup, ...backups].slice(0, 10)
    try {
      localStorage.setItem('lumbre-pos-backups', JSON.stringify(nextBackups))
    } catch (error) {
      console.error('No fue posible guardar el respaldo en este navegador.', error)
      notify('No se pudo completar la operación.', 'error')
      return
    }
    setBackups(nextBackups)
    const blob = new Blob([JSON.stringify({ application: 'Lumbre POS', version: 1, createdAt: backup.createdAt, data }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `lumbre-respaldo-${todayKey()}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    changeData((current) => current, 'Respaldo', 'Respaldo de datos generado correctamente.')
    notify('Respaldo generado correctamente.')
  }
  const restore = async (file) => {
    try {
      const parsed = JSON.parse(await file.text())
      const replacement = parsed?.data
      const arrayFields = ['products', 'tables', 'users', 'devices', 'orders', 'sales', 'events']
      const validAccounts = replacement?.accounts && typeof replacement.accounts === 'object' && !Array.isArray(replacement.accounts)
      if (!replacement || !arrayFields.every((key) => Array.isArray(replacement[key])) || !validAccounts) {
        throw new Error('El archivo no contiene un respaldo válido de Lumbre POS.')
      }
      if (!window.confirm('Restaurar este respaldo reemplazará los datos actuales. ¿Deseas continuar?')) return
      setData(withEvent(replacement, 'Respaldo', 'Administrador de red', 'Base de datos restaurada desde un respaldo.'))
      notify('Base de datos restaurada correctamente.')
    } catch (error) {
      console.error('No fue posible restaurar el respaldo.', error)
      notify(error.message || 'No se pudo completar la operación.', 'error')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }
  return <><PageHeading eyebrow="ADMINISTRACIÓN TÉCNICA" title="Respaldos" description="Protege los datos del restaurante y restaura una copia cuando sea necesario." action={<button className="button button-dark" onClick={createBackup}>↓ Generar respaldo</button>} /><div className="backup-callout"><div><span className="eyebrow">COPIA DE SEGURIDAD</span><h2>Un respaldo, por si acaso.</h2><p>Descarga una copia JSON de los datos para guardarla en una ubicación segura fuera de este equipo.</p></div><button className="button button-outline" onClick={() => fileInput.current?.click()}>Restaurar respaldo</button><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => { if (event.target.files?.[0]) restore(event.target.files[0]) }} /></div><section className="panel backup-schedule-panel"><div><p className="eyebrow">RESPALDO PROGRAMADO</p><strong>Frecuencia automática</strong><small>Se crea una copia en este navegador mientras la aplicación está abierta.</small></div><select aria-label="Frecuencia de respaldos" value={schedule.enabled ? schedule.frequency : 'manual'} onChange={(event) => setSchedule((current) => ({ ...current, enabled: event.target.value !== 'manual', frequency: event.target.value === 'manual' ? current.frequency : event.target.value }))}><option value="manual">Solo manual</option><option value="diario">Diario</option><option value="semanal">Semanal</option></select></section><section className="panel"><PanelHeading title="Respaldos recientes" /><div className="backup-history">{backups.map((backup) => <div className="backup-row" key={backup.id}><span className="backup-file-icon">JSON</span><div><strong>{backup.id}</strong><small>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(backup.createdAt))}</small></div><span>{(new Blob([JSON.stringify(backup.data)]).size / 1024).toFixed(1)} KB</span><button className="row-action" onClick={() => { const blob = new Blob([JSON.stringify({ application: 'Lumbre POS', version: 1, createdAt: backup.createdAt, data: backup.data }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${backup.id}.json`; link.click(); URL.revokeObjectURL(link.href) }}>Descargar</button></div>)}{!backups.length ? <EmptyState title="Aún no hay respaldos" description="Genera un respaldo para guardar una copia de los datos." /> : null}</div></section><p className="page-footnote">Los respaldos recientes de esta vista se guardan en este navegador. Descarga y conserva tus copias en otro dispositivo.</p></>
}

function EventLog({ data, logType, setLogType }) {
  const [search, setSearch] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const events = data.events.filter((event) => (logType === 'Todos' || event.type === logType) && (!start || dateKey(event.time) >= start) && (!end || dateKey(event.time) <= end) && `${event.actor} ${event.description}`.toLowerCase().includes(search.toLowerCase()))
  const types = ['Todos', ...new Set(data.events.map((event) => event.type))]
  return <><PageHeading eyebrow="ADMINISTRACIÓN TÉCNICA" title="Bitácora de eventos" description="Consulta los eventos y errores registrados por el sistema." /><div className="list-toolbar"><div className="filter-pills">{types.map((type) => <button key={type} className={logType === type ? 'filter-active' : ''} onClick={() => setLogType(type)}>{type}</button>)}</div><div className="log-filters"><label>Desde<input className="date-control" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Hasta<input className="date-control" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por usuario o evento" /></div></div>{events.length ? <section className="panel"><div className="log-list">{events.map((event) => <div className="log-row log-list-row" key={event.id}><span className="log-date">{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.time))}</span><span className="log-type">{event.type}</span><div><strong>{event.description}</strong><small>{event.actor}</small></div></div>)}</div></section> : <EmptyState title="No hay eventos registrados" description="Prueba con otros filtros." />}</>
}

function ProductModal({ product, data, onSave, onClose }) {
  const [form, setForm] = useState(product || { name: '', description: '', price: '', category: 'Platillos', area: 'cocina', image: '', active: true })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop" onClick={onClose}><div className="modal form-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">ADMINISTRACIÓN DEL MENÚ</p><h2>{product ? 'Editar producto' : 'Agregar producto'}</h2><form onSubmit={(event) => { event.preventDefault(); onSave(form) }}><label className="form-field">Nombre del producto<input value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={80} /></label><label className="form-field">Descripción <span>OPCIONAL</span><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows="3" maxLength={220} /></label><div className="form-row"><label className="form-field">Precio (MXN)<input type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} required /></label><label className="form-field">Categoría<select value={form.category} onChange={(event) => update('category', event.target.value)}>{[...new Set([...categories, ...data.products.map((item) => item.category)])].map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="form-row"><label className="form-field">Área de preparación<select value={form.area} onChange={(event) => update('area', event.target.value)}><option value="cocina">Cocina</option><option value="barra">Barra</option></select></label><label className="form-field">Fotografía (URL) <span>OPCIONAL</span><input type="url" value={form.image} onChange={(event) => update('image', event.target.value)} placeholder="https://…" /></label></div><label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} /> Disponible en el menú para comensales</label><div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-dark" type="submit">{product ? 'Guardar cambios' : 'Guardar producto'}</button></div></form></div></div>
}

function saveProduct(product, data, changeData, notify, setModal) {
  const name = product.name.trim()
  if (!name || !product.category || !product.area) { notify('Completa los campos obligatorios.', 'error'); return }
  if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) { notify('El precio debe ser mayor a cero.', 'error'); return }
  const duplicate = data.products.some((item) => item.id !== product.id && item.name.toLowerCase() === name.toLowerCase() && item.category === product.category)
  if (duplicate) { notify('Este producto ya existe en la categoría.', 'error'); return }
  const value = { ...product, name, price: Number(product.price), id: product.id || `p-${Date.now()}`, active: Boolean(product.active), emoji: product.emoji || '🍽️' }
  changeData((current) => ({ ...current, products: product.id ? current.products.map((item) => item.id === product.id ? value : item) : [...current.products, value] }), 'Menú', `Producto ${product.id ? 'actualizado' : 'agregado'}: ${name}.`)
  setModal(null)
  notify('Producto guardado correctamente.')
}

function TableModal({ table, onSave, onClose }) {
  const [name, setName] = useState(table?.name || '')
  const [capacity, setCapacity] = useState(table?.capacity || 2)
  return <div className="modal-backdrop" onClick={onClose}><div className="modal form-modal compact-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">ADMINISTRACIÓN DEL RESTAURANTE</p><h2>{table ? 'Editar mesa' : 'Agregar mesa'}</h2><form onSubmit={(event) => { event.preventDefault(); onSave({ ...table, name: name.trim(), capacity: Number(capacity), id: table?.id || `table-${Date.now()}` }) }}><label className="form-field">Número o nombre de la mesa<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={30} /></label><label className="form-field">Capacidad<input type="number" min="1" max="40" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label><div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-dark" type="submit">Guardar mesa</button></div></form></div></div>
}

function saveTable(table, data, changeData, notify, setModal) {
  if (!table.name) { notify('El número o nombre de la mesa es obligatorio.', 'error'); return }
  if (data.tables.some((item) => item.id !== table.id && item.name.toLowerCase() === table.name.toLowerCase())) { notify('Esta mesa ya existe.', 'error'); return }
  changeData((current) => ({ ...current, tables: table.id.startsWith('table-') ? [...current.tables, { ...table, active: true }] : current.tables.map((item) => item.id === table.id ? table : item) }), 'Mesas', `Mesa ${table.name} guardada.`)
  setModal(null)
  notify('Mesa guardada correctamente.')
}

function UserModal({ user, onSave, onClose }) {
  const [form, setForm] = useState(user || { name: '', username: '', password: '', role: 'mesero', area: 'cocina', active: true })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop" onClick={onClose}><div className="modal form-modal compact-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">ADMINISTRACIÓN DEL PERSONAL</p><h2>{user ? 'Editar acceso' : 'Agregar persona'}</h2><form onSubmit={(event) => { event.preventDefault(); onSave(form) }}><label className="form-field">Nombre completo<input value={form.name} onChange={(event) => update('name', event.target.value)} required /></label><label className="form-field">Nombre de usuario<input value={form.username} onChange={(event) => update('username', event.target.value)} required autoComplete="off" /></label><label className="form-field">Contraseña{user ? <span>OPCIONAL</span> : null}<input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required={!user} minLength="8" placeholder={user ? 'Deja en blanco para conservarla' : 'Mínimo 8 caracteres'} autoComplete="new-password" /></label><label className="form-field">Rol<select value={form.role} onChange={(event) => update('role', event.target.value)}><option value="cocinero">Cocinero</option><option value="mesero">Mesero</option><option value="cajero">Cajero</option></select></label>{form.role === 'cocinero' ? <label className="form-field">Área de preparación<select value={form.area} onChange={(event) => update('area', event.target.value)}><option value="cocina">Cocina</option><option value="barra">Barra</option></select></label> : null}<label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} /> Acceso activo</label><div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-dark" type="submit">Guardar acceso</button></div></form></div></div>
}

function saveUser(user, data, changeData, notify, setModal) {
  const username = user.username.trim()
  if (!user.name.trim() || !username || !user.role) { notify('Completa los campos obligatorios.', 'error'); return }
  if (data.users.some((item) => item.id !== user.id && item.username.toLowerCase() === username.toLowerCase())) { notify('Este nombre de usuario ya existe.', 'error'); return }
  if ((!user.id || user.password) && user.password.length < 8) { notify('La contraseña debe tener al menos 8 caracteres.', 'error'); return }
  const value = { ...user, name: user.name.trim(), username, id: user.id || `u-${Date.now()}` }
  if (user.id && !user.password) value.password = data.users.find((item) => item.id === user.id)?.password
  changeData((current) => ({ ...current, users: user.id ? current.users.map((item) => item.id === user.id ? value : item) : [...current.users, value] }), 'Personal', `Acceso ${user.id ? 'actualizado' : 'creado'}: ${username}.`)
  setModal(null)
  notify('Usuario guardado correctamente.')
}

function PaymentModal({ data, tableId, method, setMethod, received, setReceived, onClose, onConfirm }) {
  const total = tableTotal(data, tableId)
  const numericReceived = Number(received)
  const change = method === 'Efectivo' && numericReceived >= total ? numericReceived - total : 0
  return <div className="modal-backdrop" onClick={onClose}><div className="modal payment-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">COBRO DE CUENTA · MESA {tableId.padStart(2, '0')}</p><h2>Registrar pago</h2><div className="payment-modal-total"><span>Total a cobrar</span><strong>{money(total)}</strong></div><label className="form-field">Método de pago<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Efectivo</option><option>Tarjeta</option></select></label>{method === 'Efectivo' ? <><label className="form-field">Monto recibido<input type="number" min={total} step="0.01" value={received} onChange={(event) => setReceived(event.target.value)} placeholder="0.00" /></label><div className="change-amount"><span>Cambio</span><strong>{money(change)}</strong></div></> : <p className="page-footnote">Procesa el cobro en la terminal del restaurante. No se almacenan datos de tarjeta.</p>}<div className="modal-actions"><button className="button button-outline" onClick={onClose}>Cancelar</button><button className="button button-dark" onClick={onConfirm}>Confirmar pago</button></div></div></div>
}

function confirmPayment(tableId, method, received, session, data, changeData, notify, setPayment) {
  const total = tableTotal(data, tableId)
  if (method === 'Efectivo' && Number(received) < total) { notify('El monto recibido es menor al total.', 'error'); return }
  if (!tableOrders(data, tableId).length) { notify('No hay una cuenta pendiente para esta mesa.', 'error'); setPayment(null); return }
  const paymentId = `VTA-${Date.now().toString().slice(-6)}`
  const paidAt = new Date().toISOString()
  const paidOrders = tableOrders(data, tableId)
  const sale = {
    id: paymentId,
    tableId,
    tableName: data.tables.find((table) => table.id === tableId)?.name || tableId,
    total,
    method,
    paidAt,
    cashier: session?.name || 'Caja',
    items: paidOrders.flatMap((order) => order.items),
  }
  changeData((current) => ({
    ...current,
    orders: current.orders.map((order) => order.tableId === tableId && !order.paid ? { ...order, paid: true, paidAt } : order),
    sales: [...current.sales, sale],
    accounts: { ...current.accounts, [tableId]: { ...current.accounts[tableId], requested: false, paidAt, saleId: paymentId } },
  }), 'Pago', `Pago de ${money(total)} registrado para la mesa ${tableId.padStart(2, '0')} (${method.toLowerCase()}).`)
  setPayment(null)
  notify('Pago registrado correctamente.')
}

export default App
