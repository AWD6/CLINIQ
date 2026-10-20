const bridgeUrl = import.meta.env.VITE_APPS_SCRIPT_URL
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const configured = Boolean(bridgeUrl && googleClientId && !bridgeUrl.includes('YOUR_') && !googleClientId.includes('YOUR_'))
const SESSION_KEY = 'clinic-schedule-google-session'
const pending = new Map()
const queue = []
const listeners = new Set()
let frame
let ready = false
let bridgeOrigin = ''

function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (!saved?.access_token || !saved?.user?.id) return null
    const claims = JSON.parse(atob(saved.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.exp * 1000 <= Date.now()) { sessionStorage.removeItem(SESSION_KEY); return null }
    return saved
  } catch { return null }
}

function notifyAuth(event, session) {
  for (const listener of listeners) listener(event, session)
}

function ensureBridge() {
  if (!configured) throw new Error('ยังไม่ได้ตั้งค่า Apps Script URL หรือ Google Client ID')
  if (frame) return
  frame = document.createElement('iframe')
  frame.title = 'Google Sheets secure data bridge'
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', left: '-10px', bottom: '0', opacity: '0', border: '0', pointerEvents: 'none' })
  frame.src = bridgeUrl
  document.body.appendChild(frame)
}

function sendQueued() {
  if (!ready || !frame?.contentWindow) return
  while (queue.length) frame.contentWindow.postMessage(queue.shift(), bridgeOrigin)
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow) return
    const message = event.data || {}
    const trustedBridge = event.origin === 'https://script.google.com' || /^https:\/\/(?:[^/]+\.)?script\.googleusercontent\.com$/.test(event.origin)
    if (message.type === 'bridge-ready' && trustedBridge) { bridgeOrigin = event.origin; ready = true; sendQueued(); return }
    if (!trustedBridge || event.origin !== bridgeOrigin) return
    if (message.type !== 'response' || !pending.has(message.id)) return
    const { resolve, reject, timer } = pending.get(message.id)
    window.clearTimeout(timer)
    pending.delete(message.id)
    if (message.error) {
      if (/session หมดอายุ|session ไม่ถูกต้อง/.test(message.error)) {
        sessionStorage.removeItem(SESSION_KEY)
        notifyAuth('SIGNED_OUT', null)
      }
      reject(new Error(message.error))
    }
    else resolve(message.data)
  })
}

function request(action, payload = {}, token = readSession()?.access_token) {
  ensureBridge()
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const timer = window.setTimeout(() => { pending.delete(id); const index = queue.findIndex((item) => item.id === id); if (index >= 0) queue.splice(index, 1); reject(new Error('เชื่อมต่อ Google Sheets ไม่สำเร็จ กรุณาลองโหลดหน้าใหม่')) }, 30000)
    pending.set(id, { resolve, reject, timer })
    const message = { type: 'request', id, action, payload, credential: token || '' }
    if (ready && frame?.contentWindow) frame.contentWindow.postMessage(message, bridgeOrigin)
    else queue.push(message)
  })
}

class Query {
  constructor(table) { this.table = table; this.operation = 'select'; this.filters = []; this.orders = []; this.maximum = null; this.one = false; this.values = null }
  select() { return this }
  order(column, options = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this }
  eq(column, value) { this.filters.push({ op: 'eq', column, value }); return this }
  gte(column, value) { this.filters.push({ op: 'gte', column, value }); return this }
  lte(column, value) { this.filters.push({ op: 'lte', column, value }); return this }
  in(column, values) { this.filters.push({ op: 'in', column, value: values }); return this }
  limit(value) { this.maximum = value; return this }
  maybeSingle() { this.one = true; return this.execute() }
  insert(values) { this.operation = 'insert'; this.values = values; return this.execute() }
  update(values) { this.operation = 'update'; this.values = values; return this }
  then(resolve, reject) { return this.execute().then(resolve, reject) }
  async execute() {
    try {
      const data = await request('query', { table: this.table, operation: this.operation, values: this.values, filters: this.filters, orders: this.orders, limit: this.maximum, maybeSingle: this.one })
      return { data, error: null }
    } catch (error) { return { data: null, error } }
  }
}

export const isConfigured = configured
export const apiClient = {
  auth: {
    async getSession() { return { data: { session: readSession() }, error: null } },
    onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } } },
    async signInWithIdToken({ token }) {
      try {
        const result = await request('whoami', {}, token)
        const user = { id: result.profile.id, email: result.profile.email }
        const session = { access_token: result.sessionToken, user }
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
        notifyAuth('SIGNED_IN', session)
        return { data: { session, user }, error: null }
      } catch (error) { return { data: { session: null }, error } }
    },
    async signOut() { sessionStorage.removeItem(SESSION_KEY); notifyAuth('SIGNED_OUT', null); return { error: null } },
  },
  from(table) { return new Query(table) },
  async rpc(name, args = {}) {
    try { return { data: await request('rpc', { name, args }), error: null } }
    catch (error) { return { data: null, error } }
  },
  functions: {
    async invoke(name, options = {}) {
      try { return { data: await request('function', { name, body: options.body || {} }), error: null } }
      catch (error) { return { data: null, error } }
    },
  },
}

export { googleClientId }
