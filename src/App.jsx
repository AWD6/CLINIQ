import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDown, ArrowLeft, ArrowRight, Bell, CalendarDays,
  Check, CheckCheck, ChevronDown, Clock3, LogOut, Menu, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, Stethoscope, UserRound, Users,
  X, XCircle,
} from 'lucide-react'
import { isConfigured, apiClient } from './lib/sheetsClient'

const BANGKOK = 'Asia/Bangkok'
const clinicColor = ['teal', 'blue', 'rose', 'amber', 'violet', 'cyan']
const navAdmin = [
  { id: 'overview', label: 'ภาพรวม', icon: Activity },
  { id: 'sessions', label: 'ตารางและการติดตาม', icon: CalendarDays },
  { id: 'setup', label: 'แพทย์และตารางประจำ', icon: Users },
  { id: 'history', label: 'ประวัติการแก้ไข', icon: Clock3 },
]
const navDoctor = [
  { id: 'overview', label: 'ตารางของฉัน', icon: CalendarDays },
  { id: 'notifications', label: 'การแจ้งเตือน', icon: Bell },
]

const bangkokDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date)
const today = () => bangkokDate()
const addDays = (dateString, amount) => {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
const monthStart = (dateString) => `${dateString.slice(0, 7)}-01`
const shiftMonth = (month, amount) => {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return date.toISOString().slice(0, 7)
}
const timeText = (value) => (value || '').slice(0, 5)
const remainingText = (session) => {
  const remaining = Number(session.appointment_quota || 0) - Number(session.appointment_count || 0)
  return remaining >= 0 ? `คงเหลือ ${remaining}` : `เกินโควตา ${Math.abs(remaining)}`
}
const dateText = (value, options = {}) => {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00+07:00`)
  return new Intl.DateTimeFormat('th-TH', { timeZone: BANGKOK, ...options }).format(date)
}
const dateTimeText = (value) => value
  ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: BANGKOK }).format(new Date(value))
  : 'ยังไม่เคยเข้าใช้'
const weekdayText = (date) => new Intl.DateTimeFormat('th-TH', { weekday: 'long', timeZone: BANGKOK }).format(new Date(`${date}T00:00:00+07:00`))

function ConfigNotice() {
  return <main className="setup-screen"><section className="setup-card">
    <BrandMark large />
    <h1>กำลังเชื่อมต่อ Google Sheet</h1>
    <p>ยังไม่ได้ตั้งค่าลิงก์ Apps Script สำหรับบันทึกข้อมูล</p>
    <div className="code-sample">VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/…/exec</div>
    <p className="muted">ตั้งค่าครั้งเดียว แล้วเปิดเว็บใหม่ได้เลย</p>
  </section></main>
}

function BrandMark({ large = false }) {
  return <div className={`brand-mark ${large ? 'brand-mark-large' : ''}`}>
    <div className="brand-symbol"><Stethoscope size={large ? 28 : 20} strokeWidth={2.3} /></div>
    <div><strong>CLINIQ</strong><span>คลินิกเฉพาะทางนอกเวลา · มหาราชนครเชียงใหม่</span></div>
  </div>
}

function Login() {
  const [mode, setMode] = useState('choose')
  const [physicians, setPhysicians] = useState([])
  const [physicianId, setPhysicianId] = useState('')
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const physicianGroups = useMemo(() => {
    const groups = new Map()
    physicians.forEach((doctor) => {
      const label = doctor.clinic_label || 'คลินิกอื่น ๆ'
      if (!groups.has(label)) groups.set(label, { label, color: doctor.clinic_color || 'teal', doctors: [] })
      groups.get(label).doctors.push(doctor)
    })
    return [...groups.values()]
  }, [physicians])
  const selectedDoctor = physicians.find((doctor) => doctor.id === physicianId)
  useEffect(() => {
    let alive = true
    apiClient.listPhysicians().then(({ data, error: listError }) => {
      if (!alive) return
      if (listError) setError(listError.message || 'โหลดรายชื่อแพทย์ไม่สำเร็จ')
      else setPhysicians(data || [])
      setLoadingDoctors(false)
    })
    return () => { alive = false }
  }, [])
  async function enter(role, selectedPhysician = null) {
    setBusy(true); setError('')
    const { error: enterError } = await apiClient.auth.enterRole({ role, physician_id: selectedPhysician })
    setBusy(false)
    if (enterError) setError(enterError.message || 'เปิดหน้าใช้งานไม่สำเร็จ กรุณาลองใหม่')
  }
  return <main className="login-screen">
    <div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
      <div className="art-copy"><div className="art-kicker">MAHARAJ NAKORN CHIANG MAI</div><h1>CLINIQ</h1><p>คลินิกเฉพาะทางนอกเวลา<br />ตารางเวรและการตอบกลับในที่เดียว</p>
        <div className="art-note"><ShieldCheck size={18} /> บันทึกลง Google Sheet โดยตรง</div></div>
      <div className="art-bottom">คลินิกเฉพาะทางนอกเวลา · เวลาประเทศไทย</div>
    </div>
    <section className="login-panel"><div className="login-inner"><BrandMark />
      <div className="welcome"><div className="eyebrow">ตารางเวรพร้อมแล้ว ✨</div><h2>{mode === 'choose' ? 'เข้าใช้งานแบบไหน?' : 'เลือกชื่อแพทย์'}</h2><p>{mode === 'choose' ? 'แตะเลือกเพื่อไปยังหน้าที่ต้องการ' : 'ตารางและการแจ้งเตือนจะแสดงเฉพาะชื่อที่เลือก'}</p></div>
      {mode === 'choose' ? <div className="entry-choice-grid">
        <button className="entry-role-card entry-admin" onClick={() => enter('admin')} disabled={busy}><span className="entry-role-icon"><ShieldCheck size={22} /></span><span><strong>ผู้ดูแล</strong><small>จัดตาราง · อัปเดตยอดนัด · ติดตามการตอบกลับ</small></span><ArrowRight size={18} /></button>
        <button className="entry-role-card entry-doctor" onClick={() => setMode('physician')} disabled={busy}><span className="entry-role-icon"><Stethoscope size={22} /></span><span><strong>แพทย์</strong><small>ดูตาราง · ยืนยัน · แจ้งติดภารกิจ</small></span><ArrowRight size={18} /></button>
      </div> : <div className="doctor-entry-form">
        <label htmlFor="doctor-entry">เลือกชื่ออาจารย์</label>
        <div className={`specialty-selection ${selectedDoctor ? `specialty-${selectedDoctor.clinic_color}` : ''}`}>
          <span className="specialty-selection-icon"><Stethoscope size={17} /></span>
          <span><small>กลุ่มคลินิก</small><strong>{selectedDoctor?.clinic_label || 'เลือกชื่อเพื่อดูตาราง'}</strong></span>
          <span className="specialty-count">{physicians.length} ท่าน</span>
        </div>
        <select id="doctor-entry" value={physicianId} onChange={(event) => setPhysicianId(event.target.value)} disabled={loadingDoctors || busy || physicians.length === 0}>
          <option value="">{loadingDoctors ? 'กำลังโหลดรายชื่อ…' : 'เลือกชื่อของคุณ'}</option>
          {physicianGroups.map((group) => <optgroup key={group.label} label={group.label}>
            {group.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}
          </optgroup>)}
        </select>
        {!loadingDoctors && !error && physicians.length === 0 && <div className="empty-doctor-list">ยังไม่พบรายชื่ออาจารย์ กรุณากดโหลดหน้าใหม่</div>}
        <div className="doctor-entry-actions"><button className="button button-quiet" onClick={() => { setMode('choose'); setError('') }}>ย้อนกลับ</button><button className="button button-primary" disabled={!physicianId || busy} onClick={() => enter('physician', physicianId)}>{busy ? 'กำลังเปิด…' : 'ไปที่ตารางของฉัน'}<ArrowRight size={16} /></button></div>
      </div>}
      {busy && <div className="login-help"><span className="spinner spinner-small" />กำลังเปิดหน้าทำงาน…</div>}
      {error && <div className="inline-error"><AlertCircle size={17} />{error}</div>}
      <div className="login-foot">ข้อมูลนี้ทำเพื่อเตรียมความพร้อมของห้องตรวจเท่านั้น · ไม่มีข้อมูลผู้ป่วย</div>
      <div className="credit-banner">conceived, designed and Brought to life by <strong>RN.Patipon Wiyo</strong></div>
    </div></section>
  </main>
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authBusy, setAuthBusy] = useState(true)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!apiClient) { setAuthBusy(false); return }
    let alive = true
    apiClient.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setAuthBusy(false) } })
    const { data: listener } = apiClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession); setProfile(null); setProfileError(''); setAuthBusy(false)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let alive = true
    if (!session?.user) { setProfile(null); return }
    apiClient.from('user_profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data || !data.is_active) setProfileError('เปิดข้อมูลไม่สำเร็จ กรุณากลับไปเลือกหน้าใช้งานใหม่')
        else setProfile(data)
      })
    return () => { alive = false }
  }, [session])

  if (!isConfigured) return <ConfigNotice />
  if (authBusy) return <div className="loading-screen"><div className="spinner" /><span>กำลังเปิดหน้าใช้งาน…</span></div>
  if (!session) return <Login />
  if (profileError) return <main className="setup-screen"><section className="setup-card"><BrandMark large /><div className="inline-error centered"><AlertCircle size={19} />{profileError}</div><button className="button button-quiet" onClick={() => apiClient.auth.signOut()}><LogOut size={16} />ออกจากระบบ</button></section></main>
  if (!profile) return <div className="loading-screen"><div className="spinner" /><span>กำลังโหลดตาราง…</span></div>
  if (profile.role === 'physician' && !profile.physician_id) return <main className="setup-screen"><section className="setup-card"><BrandMark large /><h1>ไม่พบข้อมูลแพทย์</h1><p>กลับไปเลือกชื่อแพทย์จากหน้าแรก</p><button className="button button-quiet" onClick={() => apiClient.auth.signOut()}><LogOut size={16} />กลับหน้าแรก</button></section></main>
  return <Workspace session={session} profile={profile} />
}

function Workspace({ session, profile }) {
  const admin = profile.role === 'admin'
  const nav = admin ? navAdmin : navDoctor
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState({ clinics: [], physicians: [], templates: [], sessions: [], notifications: [], events: [], profiles: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      await apiClient.rpc('generate_due_notifications')
      const { data: next, error: workspaceError } = await apiClient.rpc('load_workspace')
      if (workspaceError) throw workspaceError
      setData(next)
    } catch (loadError) {
      setError(loadError.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally { setLoading(false); setRefreshing(false) }
  }, [admin, profile.physician_id])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 30_000)
    const activityTimer = window.setInterval(() => apiClient.rpc('touch_last_active'), 60_000)
    apiClient.rpc('touch_last_active')
    return () => { window.clearInterval(timer); window.clearInterval(activityTimer) }
  }, [refresh])
  useEffect(() => {
    const openSessions = () => { if (admin) setTab('sessions') }
    const openNotifications = () => { if (!admin) setTab('notifications') }
    window.addEventListener('open-admin-sessions', openSessions)
    window.addEventListener('go-notifications', openNotifications)
    return () => {
      window.removeEventListener('open-admin-sessions', openSessions)
      window.removeEventListener('go-notifications', openNotifications)
    }
  }, [admin])

  const unread = data.notifications.filter((item) => !item.read_at).length
  const activeTab = nav.some((item) => item.id === tab) ? tab : 'overview'
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <BrandMark />
      <div className="role-chip"><span className={`role-dot ${admin ? 'admin-dot' : ''}`} />{admin ? 'พยาบาลผู้ดูแล' : 'แพทย์'}</div>
      <div className="side-section-label">เมนูหลัก</div>
      <nav className="side-nav">{nav.map((item) => {
        const Icon = item.icon
        return <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setMobileNav(false) }}>
          <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.id === 'notifications' && unread > 0 && <b className="nav-count">{unread}</b>}
        </button>
      })}</nav>
      <div className="sidebar-spacer" />
      <div className="side-note"><div className="side-note-icon"><ShieldCheck size={16} /></div><div><strong>ข้อมูลตาราง</strong><span>ไม่มีข้อมูลผู้ป่วยในระบบ</span></div></div>
      <div className="side-user"><div className="avatar">{profile.display_name?.slice(0, 1) || 'ผ'}</div><div className="side-user-copy"><strong>{profile.display_name}</strong><span>{admin ? 'ผู้ดูแลระบบ' : data.physicians[0]?.display_name || 'แพทย์'}</span></div><button title="ออกจากระบบ" className="icon-button" onClick={() => apiClient.auth.signOut()}><LogOut size={17} /></button></div>
    </aside>
    {mobileNav && <button aria-label="ปิดเมนู" className="mobile-scrim" onClick={() => setMobileNav(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="breadcrumbs"><span>คลินิกเฉพาะทางนอกเวลา</span><ArrowRight size={13} /><strong>{nav.find((item) => item.id === activeTab)?.label}</strong></div>
        <div className="top-actions"><div className="live-indicator"><span />อัปเดตเมื่อเปิดเว็บ</div><button className={`icon-button refresh-button ${refreshing ? 'spin' : ''}`} title="โหลดข้อมูลใหม่" onClick={() => refresh(true)}><RefreshCw size={17} /></button><div className="top-avatar">{profile.display_name?.slice(0, 1) || 'ผ'}</div></div>
      </header>
      <main className="content-area">
        {error && <div className="page-alert"><AlertCircle size={17} /><span>{error}</span><button className="text-button" onClick={() => refresh()}>ลองอีกครั้ง</button></div>}
        {loading ? <div className="content-loading"><div className="spinner" /><span>กำลังโหลดข้อมูล</span></div> : admin
          ? <AdminContent tab={activeTab} data={data} refresh={() => refresh(true)} session={session} profile={profile} />
          : <DoctorContent tab={activeTab} data={data} refresh={() => refresh(true)} profile={profile} />}
      </main>
          <footer className="page-footer"><span>CLINIQ · ข้อมูลอัปเดตเมื่อเปิดหน้าเว็บ</span><span>conceived, designed and Brought to life by RN.Patipon Wiyo · เวลาไทย</span></footer>
    </div>
  </div>
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

function StatCard({ label, value, note, icon: Icon, tone = 'teal' }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></div>
}

function AdminContent({ tab, data, refresh, session, profile }) {
  if (tab === 'sessions') return <AdminSessions data={data} refresh={refresh} profile={profile} />
  if (tab === 'setup') return <AdminSetup data={data} refresh={refresh} session={session} />
  if (tab === 'history') return <AdminHistory data={data} />
  return <AdminOverview data={data} refresh={refresh} profile={profile} />
}

function AdminOverview({ data, refresh, profile }) {
  const next = data.sessions.filter((s) => s.session_status === 'scheduled' && s.session_date >= today()).slice(0, 8)
  const upcoming30 = data.sessions.filter((s) => s.session_status === 'scheduled' && s.session_date >= today() && s.session_date <= addDays(today(), 30))
  const busy = data.sessions.filter((s) => s.doctor_response_status === 'busy' && !s.resolved_at && s.session_status === 'scheduled')
  const awaiting = data.sessions.filter((s) => s.session_status === 'scheduled' && s.doctor_response_status === 'pending' && s.session_date >= today() && s.session_date <= addDays(today(), 3))
  const placeholders = data.physicians.filter((p) => p.is_placeholder && p.is_active).length
  const profilesByPhysician = new Map(data.profiles.map((p) => [p.physician_id, p]))
  const clinicMap = new Map(data.clinics.map((c) => [c.id, c.name]))
  const physicianMap = new Map(data.physicians.map((p) => [p.id, p.display_name]))
  const tasks = [
    ...busy.map((s) => ({ id: `busy-${s.id}`, icon: AlertCircle, tone: 'rose', title: `ติดภารกิจ · ${physicianMap.get(s.physician_id) || 'แพทย์'}`, detail: `${clinicMap.get(s.clinic_id)} · ${dateText(s.session_date, { day: 'numeric', month: 'short' })} · ${s.doctor_response_note || 'ยังไม่มีหมายเหตุ'}`, session: s })),
    ...awaiting.map((s) => ({ id: `await-${s.id}`, icon: Clock3, tone: 'amber', title: `ใกล้วันตรวจแต่ยังไม่ยืนยัน · ${physicianMap.get(s.physician_id) || 'แพทย์'}`, detail: `${clinicMap.get(s.clinic_id)} · ${dateText(s.session_date, { day: 'numeric', month: 'short' })}`, session: s })),
  ]
  return <>
    <PageTitle eyebrow="แดชบอร์ดผู้ดูแล" title={`สวัสดี, ${profile.display_name}`} description="ติดตามตารางออกตรวจ การยืนยัน และงานที่ต้องประสาน" action={<button className="button button-primary" onClick={() => generateNextSessions(refresh)}><Plus size={17} />สร้างรอบตรวจล่วงหน้า 90 วัน</button>} />
    <div className="welcome-strip"><div><span className="welcome-icon"><CalendarDays size={20} /></span><div><strong>วันนี้ {dateText(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>รอบตรวจที่กำหนดไว้จะสร้างจากตารางประจำโดยไม่ซ้ำกัน</small></div></div><button className="button button-outline" onClick={() => generateNextSessions(refresh)}><RefreshCw size={16} />สร้างตาราง</button></div>
    <div className="stats-grid">
      <StatCard label="รอบตรวจ 30 วัน" value={upcoming30.length} note="ทุกคลินิก" icon={CalendarDays} tone="teal" />
      <StatCard label="รอยืนยันใกล้ถึงวัน" value={awaiting.length} note="ภายใน 3 วัน" icon={Clock3} tone="amber" />
      <StatCard label="ติดภารกิจ รอจัดการ" value={busy.length} note="ต้องบันทึกผลติดตาม" icon={AlertCircle} tone="rose" />
      <StatCard label="ข้อมูลแพทย์รอยืนยัน" value={placeholders} note="ตรวจสอบชื่อก่อนใช้งานจริง" icon={Users} tone="violet" />
    </div>
    <div className="dashboard-columns">
      <section className="panel task-panel"><div className="panel-header"><div><h2>งานที่ต้องติดตาม</h2><p>กรณีที่ต้องประสานกับแพทย์หรือบันทึกผล</p></div><span className={`count-pill ${tasks.length ? 'count-warn' : ''}`}>{tasks.length} รายการ</span></div>
        {tasks.length ? <div className="task-list">{tasks.slice(0, 6).map((task) => <div className="task-row" key={task.id}><div className={`task-icon ${task.tone}`}><task.icon size={17} /></div><div className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></div><button className="button button-small button-outline" onClick={() => document.getElementById(`session-${task.session.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>ติดตาม</button></div>)}</div> : <EmptyState icon={CheckCheck} title="ไม่มีงานค้าง" description="รายการที่ต้องติดตามจะแสดงที่นี่" />}
      </section>
      <section className="panel activity-panel"><div className="panel-header"><div><h2>แพทย์เข้าเว็บล่าสุด</h2><p>ถ้ายังไม่เข้ามา พยาบาลติดตามได้จากรายการนี้</p></div><span className="subtle-tag">อัปเดตขณะเปิดเว็บ</span></div>
        <div className="last-active-list">{data.profiles.filter((p) => p.role === 'physician').slice(0, 7).map((p) => {
          const physician = data.physicians.find((item) => item.id === p.physician_id)
          const stale = !p.last_active_at || Date.now() - new Date(p.last_active_at).getTime() > 7 * 86400000
          return <div className="last-active-row" key={p.id}><div className="avatar avatar-small">{p.display_name?.slice(0, 1) || 'พ'}</div><div className="last-active-copy"><strong>{p.display_name}</strong><span>{physician?.display_name || 'ยังไม่ผูกแพทย์'}</span></div><div className={`active-time ${stale ? 'active-stale' : ''}`}><i />{p.last_active_at ? dateTimeText(p.last_active_at) : 'ยังไม่เคยเข้าเว็บ'}</div></div>
        })}{!data.profiles.some((p) => p.role === 'physician') && <p className="empty-inline">แพทย์เลือกชื่อจากหน้าแรกเมื่อเริ่มใช้ระบบ</p>}</div>
      </section>
    </div>
    <section className="panel upcoming-panel"><div className="panel-header"><div><h2>รอบตรวจถัดไป</h2><p>แสดงข้อมูลนัดรวมและการยืนยันของแพทย์</p></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('open-admin-sessions'))}>ดูตารางทั้งหมด <ArrowRight size={15} /></button></div>
      {next.length ? <div className="table-wrap"><table><thead><tr><th>วันและเวลา</th><th>คลินิก</th><th>แพทย์</th><th>ยอดนัด / โควตา</th><th>ยืนยัน</th></tr></thead><tbody>{next.map((s) => <tr key={s.id}><td><strong>{dateText(s.session_date, { day: 'numeric', month: 'short', weekday: 'short' })}</strong><span className="table-sub">{timeText(s.start_time)}–{timeText(s.end_time)} น.</span></td><td><span className="clinic-label"><i className={`clinic-dot ${clinicColor[data.clinics.findIndex((c) => c.id === s.clinic_id) % clinicColor.length]}`} />{clinicMap.get(s.clinic_id)}</span></td><td><strong>{physicianMap.get(s.physician_id) || 'ไม่พบชื่อ'}</strong>{profilesByPhysician.get(s.physician_id)?.last_active_at && <span className="table-sub">เข้าเว็บ {dateTimeText(profilesByPhysician.get(s.physician_id).last_active_at)}</span>}</td><td><div className="quota-cell"><strong>{s.appointment_count}</strong><span>/ {s.appointment_quota}</span><div className="quota-track"><i style={{ width: `${Math.min(100, s.appointment_quota ? s.appointment_count / s.appointment_quota * 100 : 0)}%` }} /></div></div></td><td><ResponseBadge status={s.doctor_response_status} /></td></tr>)}</tbody></table></div> : <EmptyState icon={CalendarDays} title="ยังไม่มีรอบตรวจที่สร้างไว้" description="กด “สร้างรอบตรวจล่วงหน้า 90 วัน” เพื่อสร้างรอบจากตารางประจำ" />}
    </section>
  </>
}

function AdminSessions({ data, refresh, profile }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7))
  const [modal, setModal] = useState(null)
  useEffect(() => {
    const listener = () => document.getElementById('session-list-start')?.scrollIntoView({ behavior: 'smooth' })
    window.addEventListener('open-admin-sessions', listener)
    return () => window.removeEventListener('open-admin-sessions', listener)
  }, [])
  const clinicMap = new Map(data.clinics.map((c) => [c.id, c.name]))
  const physicianMap = new Map(data.physicians.map((p) => [p.id, p.display_name]))
  const visible = data.sessions.filter((s) => s.session_date.startsWith(selectedMonth)
    && (statusFilter === 'all' || s.session_status === statusFilter)
    && `${clinicMap.get(s.clinic_id) || ''} ${physicianMap.get(s.physician_id) || ''}`.toLowerCase().includes(search.toLowerCase()))
  const save = async (id, payload) => {
    const { error } = await apiClient.from('schedule_sessions').update(payload).eq('id', id)
    if (error) throw error
    await refresh()
  }
  return <>
    <PageTitle eyebrow="การจัดการรอบตรวจ" title="ตารางและการติดตาม" description="แก้ไขยอดนัด งดตรวจ มอบหมายแพทย์ทดแทน และบันทึกผลประสานงาน" action={<button className="button button-primary" onClick={() => generateNextSessions(refresh)}><Plus size={17} />สร้างรอบตรวจ 90 วัน</button>} />
    <div className="filter-bar panel"><label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาคลินิกหรือแพทย์" /></label><label className="select-field"><span>เดือน</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /></label><label className="select-field"><span>สถานะ</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">ทุกรอบตรวจ</option><option value="scheduled">กำหนดตรวจ</option><option value="cancelled">งดตรวจ</option></select></label></div>
    <div id="session-list-start" className="session-list-heading"><div><h2>รอบตรวจในเดือน</h2><span>{visible.length} รายการ · สร้างจากตารางประจำได้โดยไม่ซ้ำ</span></div><button className="button button-outline button-small" onClick={() => generateNextSessions(refresh)}><RefreshCw size={15} />สร้างรอบล่วงหน้า</button></div>
    <div className="admin-session-list">{visible.map((s, i) => <AdminSessionCard key={s.id} item={s} index={i} clinicName={clinicMap.get(s.clinic_id)} physicianName={physicianMap.get(s.physician_id)} doctors={data.physicians.filter((p) => p.is_active && !p.is_placeholder)} onEdit={(type) => setModal({ type, session: s })} onSave={save} />)}
      {!visible.length && <EmptyState icon={CalendarDays} title="ไม่มีรอบตรวจในช่วงนี้" description="สร้างรอบจากตารางประจำ หรือเลือกเดือนอื่น" />}</div>
    {modal && <SessionActionModal modal={modal} doctors={data.physicians.filter((p) => p.is_active && !p.is_placeholder)} profile={profile} onClose={() => setModal(null)} onSave={async (payload) => { await save(modal.session.id, payload); setModal(null) }} />}
  </>
}

function AdminSessionCard({ item, index, clinicName, physicianName, doctors, onEdit, onSave }) {
  const [editing, setEditing] = useState(false)
  const [quota, setQuota] = useState(item.appointment_quota)
  const [count, setCount] = useState(item.appointment_count)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setQuota(item.appointment_quota); setCount(item.appointment_count) }, [item.appointment_quota, item.appointment_count])
  async function saveMetrics() {
    setSaving(true); setError('')
    try { await onSave(item.id, { appointment_quota: Number(quota), appointment_count: Number(count) }); setEditing(false) }
    catch { setError('บันทึกไม่สำเร็จ ตรวจสอบว่าจำนวนที่นัดไม่เกินโควตาหรือไม่') }
    finally { setSaving(false) }
  }
  return <article id={`session-${item.id}`} className={`admin-session-card ${item.session_status === 'cancelled' ? 'session-cancelled' : ''}`}>
    <div className="session-date-col"><div className="session-day">{dateText(item.session_date, { day: '2-digit' })}</div><div className="session-month">{dateText(item.session_date, { month: 'short', weekday: 'short' })}</div></div>
    <div className="session-main"><div className="session-title-line"><strong>{clinicName || 'คลินิก'}</strong><span className="session-time"><Clock3 size={14} />{timeText(item.start_time)}–{timeText(item.end_time)} น.</span>{item.replaces_physician_id && <span className="subtle-tag">มีแพทย์ทดแทน</span>}</div>
      <div className="session-doctor"><UserRound size={15} />{physicianName || 'แพทย์'}<span className="middot">·</span><ResponseBadge status={item.doctor_response_status} /></div>
      {item.session_status === 'cancelled' && <div className="cancelled-note"><XCircle size={14} />งดตรวจ: {item.cancellation_reason || 'บันทึกโดยผู้ดูแล'}</div>}
      {item.doctor_response_status === 'busy' && <div className="busy-note"><AlertCircle size={14} />แจ้งติดภารกิจ{item.doctor_response_note ? `: ${item.doctor_response_note}` : ''}{!item.resolved_at && <span className="needs-resolution">· รอบันทึกผลจัดการ</span>}</div>}
      {item.admin_resolution_note && <div className="resolution-note"><Check size={14} />ผลการจัดการ: {item.admin_resolution_note}</div>}
    </div>
    <div className="session-quota-area">{editing ? <div className="inline-metrics"><label>นัดแล้ว<input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} /></label><span>/</span><label>โควตา<input type="number" min="0" value={quota} onChange={(e) => setQuota(e.target.value)} /></label></div> : <div className="metric-display"><strong>{item.appointment_count}<small> / {item.appointment_quota}</small></strong><span>นัดแล้ว / โควตา</span><div className="quota-track"><i style={{ width: `${Math.min(100, item.appointment_quota ? item.appointment_count / item.appointment_quota * 100 : 0)}%` }} /></div></div>}
      {error && <small className="field-error">{error}</small>}
    </div>
    <div className="session-actions">{editing ? <><button className="button button-small button-primary" disabled={saving} onClick={saveMetrics}>บันทึก</button><button className="icon-button" onClick={() => setEditing(false)}><X size={16} /></button></> : <><button className="button button-small button-outline" onClick={() => setEditing(true)}>แก้ยอด</button>
      {item.session_status === 'scheduled' && item.doctor_response_status === 'busy' && <button className="button button-small button-quiet" onClick={() => onEdit('busy')}>{item.resolved_at ? 'แก้ผลจัดการ' : 'ผลจัดการ'}</button>}
      {item.session_status === 'scheduled' && <button className="icon-button danger-icon" title="งดตรวจ" onClick={() => onEdit('cancel')}><XCircle size={17} /></button>}
      {item.session_status === 'scheduled' && <button className="icon-button" title="กำหนดแพทย์ทดแทน" onClick={() => onEdit('replace')}><Users size={17} /></button>}
    </>}</div>
  </article>
}

function SessionActionModal({ modal, doctors, profile, onClose, onSave }) {
  const [reason, setReason] = useState(modal.session.doctor_response_note || '')
  const [replacement, setReplacement] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const session = modal.session
  const title = modal.type === 'cancel' ? 'บันทึกการงดตรวจ' : modal.type === 'replace' ? 'กำหนดแพทย์ทดแทน' : 'บันทึกผลจัดการการติดภารกิจ'
  async function save() {
    if (!reason.trim()) { setError('กรุณาระบุหมายเหตุหรือผลการจัดการ'); return }
    if (modal.type === 'replace' && !replacement) { setError('กรุณาเลือกแพทย์ทดแทน'); return }
    setBusy(true); setError('')
    const common = { admin_resolution_note: reason.trim(), resolved_by: profile.id, resolved_at: new Date().toISOString() }
    let payload = common
    if (modal.type === 'cancel') payload = { ...common, session_status: 'cancelled', cancellation_reason: reason.trim() }
    if (modal.type === 'replace') payload = { ...common, physician_id: replacement, replaces_physician_id: session.replaces_physician_id || session.physician_id, session_status: 'scheduled', cancellation_reason: null, doctor_response_status: 'pending', doctor_response_note: null, doctor_responded_at: null }
    try { await onSave(payload) } catch (saveError) { setError(saveError.message || 'บันทึกไม่สำเร็จ'); setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <button className="modal-close icon-button" onClick={onClose}><X size={18} /></button><div className="eyebrow">{dateText(session.session_date, { weekday: 'long', day: 'numeric', month: 'long' })} · {timeText(session.start_time)} น.</div><h2 id="modal-title">{title}</h2><p>{session.doctor_response_note ? `หมายเหตุแพทย์: ${session.doctor_response_note}` : 'บันทึกไว้ในประวัติการติดตามของระบบ'}</p>
    {modal.type === 'replace' && <label className="modal-label">แพทย์ทดแทน<select value={replacement} onChange={(e) => setReplacement(e.target.value)}><option value="">เลือกแพทย์</option>{doctors.filter((d) => d.id !== session.physician_id).map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}</select></label>}
    {modal.type === 'cancel' && <div className="soft-warning"><AlertCircle size={17} /><span>การบันทึกนี้ไม่ยกเลิกหรือลบยอดนัดผู้ป่วยโดยอัตโนมัติ ให้ประสานงานและจัดการนัดแยกตามขั้นตอนของหน่วยงาน</span></div>}
    <label className="modal-label">{modal.type === 'cancel' ? 'เหตุผลงดตรวจ' : modal.type === 'replace' ? 'หมายเหตุการทดแทน' : 'ผลการประสานงาน'}<textarea rows="3" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="พิมพ์สรุปการจัดการ…" /><small className="note-privacy">บันทึกเฉพาะการประสานงาน · ไม่ใส่ชื่อหรือข้อมูลผู้ป่วย</small></label>
    {error && <div className="inline-error"><AlertCircle size={16} />{error}</div>}
    <div className="modal-actions"><button className="button button-quiet" onClick={onClose}>กลับ</button><button className="button button-primary" disabled={busy} onClick={save}><Check size={16} />{busy ? 'กำลังบันทึก…' : 'บันทึกผล'}</button></div>
  </section></div>
}

function AdminSetup({ data, refresh }) {
  const [clinicName, setClinicName] = useState('')
  const [clinicShort, setClinicShort] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorClinicId, setDoctorClinicId] = useState('')
  const [weekday, setWeekday] = useState('1')
  const [weekOfMonth, setWeekOfMonth] = useState('0')
  const [clinicId, setClinicId] = useState('')
  const [physicianId, setPhysicianId] = useState('')
  const [quota, setQuota] = useState('20')
  const [slotError, setSlotError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [templateEdit, setTemplateEdit] = useState(null)
  const [physicianEdit, setPhysicianEdit] = useState(null)
  const clinicMap = new Map(data.clinics.map((c) => [c.id, c.name]))
  const physicianMap = new Map(data.physicians.map((p) => [p.id, p]))
  const activeDoctors = data.physicians.filter((p) => p.is_active)

  async function addClinic(e) {
    e.preventDefault(); setSaving(true); setNotice(''); setSlotError('')
    const { error } = await apiClient.from('clinics').insert({ name: clinicName.trim(), short_name: (clinicShort || clinicName).trim() })
    if (error) setSlotError(error.message); else { setClinicName(''); setClinicShort(''); setNotice('เพิ่มคลินิกแล้ว'); await refresh() }
    setSaving(false)
  }
  async function addPhysician(e) {
    e.preventDefault(); setSaving(true); setNotice(''); setSlotError('')
    const { error } = await apiClient.from('physicians').insert({ display_name: doctorName.trim(), clinic_id: doctorClinicId, is_placeholder: false, notes: 'เพิ่มโดยพยาบาลผู้ดูแล' })
    if (error) setSlotError(error.message); else { setDoctorName(''); setNotice('เพิ่มข้อมูลแพทย์แล้ว'); await refresh() }
    setSaving(false)
  }
  async function addTemplate(e) {
    e.preventDefault(); setSaving(true); setSlotError(''); setNotice('')
    const isSaturday = Number(weekday) === 6
    const { error } = await apiClient.from('schedule_templates').insert({ clinic_id: clinicId, physician_id: physicianId, weekday: Number(weekday), week_of_month: Number(weekOfMonth), start_time: isSaturday ? '08:00' : '16:00', end_time: isSaturday ? '12:00' : '20:00', appointment_quota: Number(quota), effective_from: today() })
    if (error) setSlotError(error.message.includes('duplicate') ? 'มีตารางประจำรายการนี้อยู่แล้ว' : error.message)
    else { setNotice('เพิ่มตารางประจำแล้ว'); await refresh() }
    setSaving(false)
  }
  async function saveTemplate() {
    setSaving(true); setSlotError('')
    const { error } = await apiClient.from('schedule_templates').update({ appointment_quota: Number(templateEdit.quota), start_time: templateEdit.start_time, end_time: templateEdit.end_time }).eq('id', templateEdit.id)
    if (error) setSlotError(error.message); else { setTemplateEdit(null); setNotice('บันทึกตารางประจำแล้ว'); await refresh() }
    setSaving(false)
  }
  async function toggleTemplate(template) {
    const { error } = await apiClient.from('schedule_templates').update({ is_active: !template.is_active }).eq('id', template.id)
    if (error) setSlotError(error.message); else await refresh()
  }
  async function togglePhysician(physician) {
    const { error } = await apiClient.from('physicians').update({ is_active: !physician.is_active }).eq('id', physician.id)
    if (error) setSlotError(error.message); else await refresh()
  }
  async function toggleClinic(clinic) {
    const { error } = await apiClient.from('clinics').update({ is_active: !clinic.is_active }).eq('id', clinic.id)
    if (error) setSlotError(error.message); else await refresh()
  }
  async function savePhysicianName() {
    if (!physicianEdit?.display_name.trim()) { setSlotError('กรุณาระบุชื่อแพทย์'); return }
    setSaving(true); setSlotError('')
    const { error } = await apiClient.from('physicians').update({ display_name: physicianEdit.display_name.trim(), is_placeholder: false, notes: 'ยืนยันชื่อโดยพยาบาลผู้ดูแล' }).eq('id', physicianEdit.id)
    if (error) setSlotError(error.message); else { setPhysicianEdit(null); setNotice('ยืนยันชื่อแพทย์แล้ว'); await refresh() }
    setSaving(false)
  }
  const dow = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
  return <>
    <PageTitle eyebrow="จัดการข้อมูลตั้งต้น" title="แพทย์และตารางประจำ" description="แก้ข้อมูลคลินิก แพทย์ และวันออกตรวจประจำก่อนสร้างรอบตรวจจริง" />
    {notice && <div className="success-banner"><Check size={16} />{notice}<button className="icon-button" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {slotError && <div className="page-alert"><AlertCircle size={17} />{slotError}<button className="icon-button" onClick={() => setSlotError('')}><X size={15} /></button></div>}
    <div className="setup-grid">
      <section className="panel setup-panel"><div className="panel-header"><div><h2>คลินิก</h2><p>ชื่อคลินิกที่ใช้ในตาราง</p></div><span className="count-pill">{data.clinics.length}</span></div>
        <div className="chip-list">{data.clinics.map((c, i) => <button type="button" className={`clinic-chip ${!c.is_active ? 'clinic-chip-inactive' : ''}`} key={c.id} onClick={() => toggleClinic(c)} title={c.is_active ? 'กดเพื่อปิดใช้คลินิก' : 'กดเพื่อเปิดใช้คลินิก'}><i className={`clinic-dot ${clinicColor[i % clinicColor.length]}`} />{c.name}<span>{c.is_active ? 'ใช้งาน' : 'ปิดใช้'}</span></button>)}</div>
        <form className="compact-form two-fields" onSubmit={addClinic}><label>ชื่อคลินิก<input required value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="เช่น คลินิกผิวหนัง" /></label><label>ชื่อย่อ<input required value={clinicShort} onChange={(e) => setClinicShort(e.target.value)} placeholder="ชื่อย่อ" /></label><button className="button button-primary button-small" disabled={saving}><Plus size={15} />เพิ่มคลินิก</button></form>
      </section>
      <section className="panel setup-panel"><div className="panel-header"><div><h2>เพิ่มข้อมูลแพทย์</h2><p>แพทย์เลือกชื่อตัวเองจากหน้าแรกเพื่อเข้าดูตาราง</p></div><UserRound size={19} className="muted-icon" /></div>
        <form className="compact-form two-fields" onSubmit={addPhysician}><label>ชื่อที่แสดง<input required value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="เช่น อ.ชื่อ" /></label><label>กลุ่มคลินิก<select required value={doctorClinicId} onChange={(e) => setDoctorClinicId(e.target.value)}><option value="">เลือกคลินิก</option>{data.clinics.filter((c) => c.is_active).map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><button className="button button-primary button-small" disabled={saving}><Plus size={15} />เพิ่มแพทย์</button></form>
        <div className="helper-line"><AlertCircle size={15} />ตรวจสอบชื่อในตารางภาพก่อนเปลี่ยน placeholder เป็นชื่อจริง</div>
      </section>
    </div>
    <section className="panel template-panel"><div className="panel-header"><div><h2>ตารางเวรประจำ</h2><p>แยกจากรอบตรวจที่สร้างแล้ว การแก้ตารางนี้มีผลต่อรอบที่สร้างในอนาคตเท่านั้น</p></div><span className="subtle-tag">จ–ศ 16:00–20:00 · ส 08:00–12:00</span></div>
      <form className="template-create" onSubmit={addTemplate}><label>คลินิก<select required value={clinicId} onChange={(e) => setClinicId(e.target.value)}><option value="">เลือกคลินิก</option>{data.clinics.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>แพทย์<select required value={physicianId} onChange={(e) => setPhysicianId(e.target.value)}><option value="">เลือกแพทย์</option>{activeDoctors.map((p) => <option key={p.id} value={p.id}>{p.display_name}{p.is_placeholder ? ' · รอยืนยัน' : ''}</option>)}</select></label><label>วัน<select value={weekday} onChange={(e) => setWeekday(e.target.value)}>{[1, 2, 3, 4, 5, 6].map((day) => <option key={day} value={day}>{dow[day]}</option>)}</select></label><label>สัปดาห์ของเดือน<select value={weekOfMonth} onChange={(e) => setWeekOfMonth(e.target.value)}><option value="0">ทุกสัปดาห์</option>{[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>สัปดาห์ที่ {w}</option>)}</select></label><label>โควตา<input type="number" min="0" required value={quota} onChange={(e) => setQuota(e.target.value)} /></label><button className="button button-primary" disabled={saving}><Plus size={16} />เพิ่มตารางประจำ</button></form>
      <div className="table-wrap template-table"><table><thead><tr><th>วัน / เวลา</th><th>คลินิก</th><th>แพทย์</th><th>โควตาต่อรอบ</th><th>สถานะ</th><th></th></tr></thead><tbody>{data.templates.map((t) => {
        const doctor = physicianMap.get(t.physician_id)
        return <tr key={t.id}><td>{dow[t.weekday]}{t.week_of_month ? ` · สัปดาห์ที่ ${t.week_of_month}` : ''}<span className="table-sub">{timeText(t.start_time)}–{timeText(t.end_time)} น.</span></td><td>{clinicMap.get(t.clinic_id)}</td><td>{doctor?.display_name || 'ไม่พบชื่อ'}{doctor?.is_placeholder && <span className="table-sub placeholder-label">รอยืนยันชื่อแพทย์</span>}</td><td>{templateEdit?.id === t.id ? <div className="template-edit-fields"><input type="time" value={templateEdit.start_time} onChange={(e) => setTemplateEdit({ ...templateEdit, start_time: e.target.value })} /><input type="time" value={templateEdit.end_time} onChange={(e) => setTemplateEdit({ ...templateEdit, end_time: e.target.value })} /><input type="number" min="0" value={templateEdit.quota} onChange={(e) => setTemplateEdit({ ...templateEdit, quota: e.target.value })} /><button className="button button-small button-primary" onClick={saveTemplate}>บันทึก</button></div> : t.appointment_quota}</td><td><span className={`status-pill ${t.is_active ? 'status-green' : 'status-gray'}`}>{t.is_active ? 'ใช้งาน' : 'หยุดใช้'}</span></td><td><button className="text-button" onClick={() => templateEdit?.id === t.id ? setTemplateEdit(null) : setTemplateEdit({ id: t.id, quota: t.appointment_quota, start_time: timeText(t.start_time), end_time: timeText(t.end_time) })}>แก้ไข</button><button className="text-button subtle-action" onClick={() => toggleTemplate(t)}>{t.is_active ? 'หยุดใช้' : 'เปิดใช้'}</button></td></tr>
      })}{!data.templates.length && <tr><td colSpan="6" className="table-empty">ยังไม่มีตารางเวรประจำ</td></tr>}</tbody></table></div>
    </section>
    <section className="panel doctor-directory"><div className="panel-header"><div><h2>รายชื่อแพทย์</h2><p>ข้อมูลที่ถอดจากภาพยังต้องให้ผู้ดูแลยืนยันก่อนใช้จริง</p></div><span className="count-pill">{data.physicians.length} ราย</span></div>
      <div className="doctor-directory-grid">{data.physicians.map((p) => {
        const user = data.profiles.find((item) => item.physician_id === p.id)
        const editing = physicianEdit?.id === p.id
        return <div className={`doctor-directory-card ${p.is_placeholder ? 'doctor-placeholder' : ''}`} key={p.id}>
          <div className="doctor-icon"><UserRound size={16} /></div>
          <div className="doctor-directory-copy">{editing ? <input className="doctor-name-edit" value={physicianEdit.display_name} onChange={(e) => setPhysicianEdit({ ...physicianEdit, display_name: e.target.value })} aria-label="ชื่อแพทย์" /> : <strong>{p.display_name}</strong>}<span>{user ? `เข้าเว็บล่าสุด ${dateTimeText(user.last_active_at)}` : p.is_placeholder ? 'ชื่อรอยืนยัน' : 'เลือกชื่อเพื่อเข้าใช้'}</span></div>
          <span className={`status-pill ${p.is_active ? p.is_placeholder ? 'status-amber' : 'status-green' : 'status-gray'}`}>{!p.is_active ? 'ปิดใช้' : p.is_placeholder ? 'รอยืนยัน' : user ? 'เคยเข้าเว็บ' : 'พร้อมใช้'}</span>
          {editing ? <button className="text-button" disabled={saving} onClick={savePhysicianName}>บันทึก</button> : <button className="text-button" onClick={() => setPhysicianEdit({ id: p.id, display_name: p.display_name })}>{p.is_placeholder ? 'ยืนยันชื่อ' : 'แก้ชื่อ'}</button>}
          <button className="text-button" onClick={() => togglePhysician(p)}>{p.is_active ? 'ปิดใช้' : 'เปิดใช้'}</button>
        </div>
      })}</div>
    </section>
  </>
}

function AdminHistory({ data }) {
  const profileMap = new Map(data.profiles.map((p) => [p.id, p.display_name]))
  const physicianMap = new Map(data.physicians.map((p) => [p.id, p.display_name]))
  const clinicMap = new Map(data.clinics.map((c) => [c.id, c.name]))
  const description = (event) => {
    const next = event.details?.new || {}
    const old = event.details?.old || {}
    const row = next.id ? next : old
    if (event.entity_type === 'clinics') return `${event.action === 'insert' ? 'เพิ่มคลินิก' : event.action === 'delete' ? 'ลบคลินิก' : 'แก้ไขคลินิก'} · ${row.name || ''}`
    if (event.entity_type === 'physicians') return `${event.action === 'insert' ? 'เพิ่มข้อมูลแพทย์' : event.action === 'delete' ? 'ลบข้อมูลแพทย์' : 'แก้ไขข้อมูลแพทย์'} · ${row.display_name || ''}`
    if (event.entity_type === 'schedule_templates') {
      const template = row
      const dow = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
      return `${event.action === 'insert' ? 'เพิ่มตารางประจำ' : event.action === 'delete' ? 'ลบตารางประจำ' : 'แก้ไขตารางประจำ'} · ${clinicMap.get(template.clinic_id) || 'คลินิก'} · ${physicianMap.get(template.physician_id) || 'แพทย์'} · ${dow[template.weekday] || ''}`
    }
    const clinic = clinicMap.get(row.clinic_id)
    const physician = physicianMap.get(row.physician_id)
    if (event.action === 'insert') return `สร้างรอบตรวจ ${clinic || ''} · ${physician || ''}`
    if (event.action === 'delete') return `ลบรอบตรวจ ${clinic || ''} · ${physician || ''}`
    const changes = []
    if (old.physician_id !== next.physician_id) changes.push(`เปลี่ยนแพทย์ผู้ตรวจ ${physicianMap.get(old.physician_id) || ''} → ${physicianMap.get(next.physician_id) || ''}`)
    if (old.session_status !== next.session_status) changes.push(next.session_status === 'cancelled' ? `บันทึกงดตรวจ: ${next.cancellation_reason || ''}` : 'เปิดรอบตรวจ')
    if (old.appointment_count !== next.appointment_count || old.appointment_quota !== next.appointment_quota) changes.push(`ยอดนัด/โควตา ${old.appointment_count ?? 0}/${old.appointment_quota ?? 0} → ${next.appointment_count ?? 0}/${next.appointment_quota ?? 0}`)
    if (old.doctor_response_status !== next.doctor_response_status) changes.push(`แพทย์ตอบ ${responseLabel(next.doctor_response_status)}${next.doctor_response_note ? `: ${next.doctor_response_note}` : ''}`)
    if (old.admin_resolution_note !== next.admin_resolution_note && next.admin_resolution_note) changes.push(`ผลจัดการ: ${next.admin_resolution_note}`)
    return changes.length ? `${clinic || ''} · ${changes.join(' · ')}` : `แก้ไขข้อมูลรอบตรวจ ${clinic || ''} · ${physician || ''}`
  }
  return <><PageTitle eyebrow="ประวัติระบบ" title="ประวัติการแก้ไข" description="ติดตามการปรับตาราง ยอดนัด การตอบกลับ และผลจัดการของผู้ดูแล" />
    <section className="panel history-panel"><div className="panel-header"><div><h2>รายการล่าสุด</h2><p>เก็บเวลาและผู้ดำเนินการไว้กับทุกรอบตรวจ</p></div><span className="subtle-tag">{data.events.length} รายการ</span></div>
      <div className="history-list">{data.events.map((event) => <div className="history-row" key={event.id}><div className={`history-icon ${event.action === 'update' ? 'history-update' : 'history-create'}`}>{event.action === 'update' ? <Settings2 size={16} /> : <Plus size={16} />}</div><div className="history-copy"><strong>{description(event)}</strong><span>{profileMap.get(event.actor_id) || 'ระบบ'} · {dateTimeText(event.created_at)}</span></div><span className="history-kind">{event.action === 'update' ? 'แก้ไข' : event.action === 'insert' ? 'สร้าง' : 'ลบ'}</span></div>)}
        {!data.events.length && <EmptyState icon={Clock3} title="ยังไม่มีประวัติการแก้ไข" description="รายการจะปรากฏเมื่อมีการสร้างหรือแก้ไขรอบตรวจ" />}</div>
    </section></>
}

function DoctorContent({ tab, data, refresh, profile }) {
  if (tab === 'notifications') return <NotificationCenter notifications={data.notifications} refresh={refresh} />
  return <DoctorDashboard data={data} refresh={refresh} profile={profile} />
}

function DoctorDashboard({ data, refresh, profile }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState('')
  const [responseModal, setResponseModal] = useState(null)
  const thisMonth = data.sessions.filter((s) => s.session_date.startsWith(month))
  const upcoming = data.sessions.filter((s) => s.session_status === 'scheduled' && s.session_date >= today()).sort((a, b) => `${a.session_date}${a.start_time}`.localeCompare(`${b.session_date}${b.start_time}`))
  const next = upcoming[0]
  const nextAssigned = next?.physician_id === profile.physician_id
  const clinicMap = new Map(data.clinics.map((c) => [c.id, c.name]))
  const dateSessions = thisMonth.filter((s) => s.session_date === selectedDate)
  const unread = data.notifications.filter((n) => !n.read_at).length
  const nextUp = next && next.session_date <= addDays(today(), 7)
  async function respond(session, response, note) {
    const { error } = await apiClient.rpc('respond_to_session', { p_session_id: session.id, p_response: response, p_note: note || null })
    if (error) throw error
    await refresh()
  }
  return <>
    <PageTitle eyebrow="พื้นที่แพทย์" title={`สวัสดี, ${profile.display_name}`} description="ดูตารางออกตรวจและยอดนัดของคุณ พร้อมตอบกลับการยืนยันในหน้าเว็บ" action={<button className="button button-outline" onClick={() => window.dispatchEvent(new CustomEvent('go-notifications'))}><Bell size={17} />การแจ้งเตือน {unread > 0 && <span className="button-badge">{unread}</span>}</button>} />
    {next ? <section className="next-session-card"><div className="next-glow" /><div className="next-label"><span className="next-icon"><CalendarDays size={18} /></span><span>{nextUp ? 'รอบตรวจถัดไป · ใกล้ถึงวัน' : 'รอบตรวจถัดไป'}</span><span className={`response-chip response-${nextAssigned ? next.doctor_response_status : 'confirmed'}`}>{nextAssigned ? responseLabel(next.doctor_response_status) : 'มีแพทย์ทดแทน'}</span></div><div className="next-main"><div><strong>{clinicMap.get(next.clinic_id) || 'คลินิก'}</strong><span>{weekdayText(next.session_date)} {dateText(next.session_date, { day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="next-time"><Clock3 size={17} />{timeText(next.start_time)}–{timeText(next.end_time)} น.</span></div><div className="next-appointments"><span>ยอดนัด · โควตา · {remainingText(next)}</span><strong>{next.appointment_count}<small> / {next.appointment_quota}</small></strong><div className="quota-track quota-track-light"><i style={{ width: `${Math.min(100, next.appointment_quota ? next.appointment_count / next.appointment_quota * 100 : 0)}%` }} /></div><small className="updated-at">ยอดนัดอัปเดต {dateTimeText(next.appointment_updated_at || next.updated_at)}</small></div></div>
      {!nextAssigned && next.replaces_physician_id === profile.physician_id && <div className="replacement-banner"><Users size={16} />รอบนี้มีแพทย์ทดแทนแล้ว คุณไม่ต้องตอบกลับรอบนี้</div>}
      {nextAssigned && next.doctor_response_status === 'pending' && <div className="next-actions"><button className="button button-light" onClick={() => respond(next, 'confirmed')}><Check size={16} />ยืนยันออกตรวจ</button><button className="button button-light-outline" onClick={() => setResponseModal(next)}><AlertCircle size={16} />แจ้งติดภารกิจ</button></div>}
      {nextAssigned && next.doctor_response_status === 'confirmed' && <div className="confirmation-line"><CheckCheck size={16} />ยืนยันแล้ว{next.doctor_responded_at ? ` · ${dateTimeText(next.doctor_responded_at)}` : ''}</div>}
      {nextAssigned && next.doctor_response_status === 'busy' && <div className="doctor-busy-line"><AlertCircle size={16} />แจ้งติดภารกิจแล้ว · รอพยาบาลผู้ดูแลบันทึกผลการจัดการ</div>}
      {!nextAssigned && next.replaces_physician_id === profile.physician_id && <div className="confirmation-line"><CheckCheck size={16} />ผู้ดูแลบันทึกการจัดแพทย์ทดแทนแล้ว</div>}
    </section> : <section className="next-session-empty"><CalendarDays size={23} /><div><strong>ยังไม่มีรอบตรวจถัดไป</strong><span>ติดต่อพยาบาลผู้ดูแลหากตารางของคุณยังไม่แสดง</span></div></section>}
    <section className="panel calendar-panel"><div className="panel-header calendar-heading"><div><h2>ตารางรายเดือน</h2><p>แตะวันที่มีรอบตรวจเพื่อดูคลินิกและยอดนัด</p></div><div className="month-control"><button className="icon-button" onClick={() => setMonth(shiftMonth(month, -1))}><ArrowLeft size={17} /></button><strong>{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: BANGKOK }).format(new Date(`${month}-01T00:00:00+07:00`))}</strong><button className="icon-button" onClick={() => setMonth(shiftMonth(month, 1))}><ArrowRight size={17} /></button></div></div>
      <MonthCalendar month={month} sessions={thisMonth} selectedDate={selectedDate} onSelect={(date) => setSelectedDate(date === selectedDate ? '' : date)} />
      {selectedDate && <div className="selected-day-detail"><div className="selected-day-head"><h3>{dateText(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h3><button className="text-button" onClick={() => setSelectedDate('')}>ปิด</button></div>{dateSessions.length ? dateSessions.map((s) => <DoctorSessionRow key={s.id} item={s} clinicName={clinicMap.get(s.clinic_id)} onRespond={setResponseModal} physicianId={profile.physician_id} />) : <p className="empty-inline">ไม่มีรอบตรวจในวันนี้</p>}</div>}
    </section>
    <div className="doctor-summary-grid"><section className="panel summary-panel"><div className="panel-header"><div><h2>รายการถัดไป</h2><p>วันและยอดนัดของคุณ</p></div><CalendarDays size={18} className="muted-icon" /></div>{upcoming.slice(0, 4).map((s) => <DoctorSessionRow key={s.id} item={s} clinicName={clinicMap.get(s.clinic_id)} onRespond={setResponseModal} physicianId={profile.physician_id} compact />)}{!upcoming.length && <p className="empty-inline">ยังไม่มีรอบตรวจในอนาคต</p>}</section>
      <section className="panel summary-panel notice-summary"><div className="panel-header"><div><h2>การแจ้งเตือนล่าสุด</h2><p>ระบบสร้างเตือนเมื่อเปิดเว็บตามกำหนด</p></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('go-notifications'))}>ทั้งหมด <ArrowRight size={15} /></button></div>{data.notifications.slice(0, 3).map((n) => <div className={`notice-mini ${!n.read_at ? 'notice-unread' : ''}`} key={n.id}><span className="notice-mini-icon"><Bell size={15} /></span><div><strong>{n.title}</strong><span>{n.body}</span></div></div>)}{!data.notifications.length && <p className="empty-inline">ยังไม่มีการแจ้งเตือน</p>}</section></div>
    {responseModal && <BusyResponseModal session={responseModal} clinicName={clinicMap.get(responseModal.clinic_id)} onClose={() => setResponseModal(null)} onSave={async (note) => { await respond(responseModal, 'busy', note); setResponseModal(null) }} />}
  </>
}

function MonthCalendar({ month, sessions, selectedDate, onSelect }) {
  const [year, monthNum] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const firstDay = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const sessionsByDay = new Map()
  sessions.forEach((s) => sessionsByDay.set(Number(s.session_date.slice(-2)), [...(sessionsByDay.get(Number(s.session_date.slice(-2))) || []), s]))
  const todayDay = today().startsWith(month) ? Number(today().slice(-2)) : -1
  const weekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
  return <div className="month-calendar"><div className="calendar-grid calendar-weekdays">{weekdays.map((d, i) => <div className={i === 0 || i === 6 ? 'weekend' : ''} key={d}>{d}</div>)}</div><div className="calendar-grid">{cells.map((day, index) => {
    const dateKey = day ? `${month}-${String(day).padStart(2, '0')}` : ''
    const daySessions = day ? sessionsByDay.get(day) || [] : []
    return <button key={`${month}-${index}`} disabled={!day} onClick={() => day && onSelect(dateKey)} className={`calendar-cell ${!day ? 'cell-empty' : ''} ${day === todayDay ? 'cell-today' : ''} ${selectedDate === dateKey ? 'cell-selected' : ''} ${index % 7 === 0 || index % 7 === 6 ? 'cell-weekend' : ''}`}><span className="calendar-number">{day || ''}</span>{daySessions.length > 0 && <span className="calendar-events">{daySessions.slice(0, 2).map((s, i) => <i key={`${s.id}-${i}`} className={`calendar-event-dot event-${clinicColor[i % clinicColor.length]}`} />)}{daySessions.length > 2 && <small>+{daySessions.length - 2}</small>}</span>}</button>
  })}</div><div className="calendar-legend"><span><i className="calendar-event-dot event-teal" />มีรอบตรวจ</span><span><i className="calendar-event-dot event-rose" />มากกว่า 1 รอบ</span></div></div>
}

function DoctorSessionRow({ item, clinicName, onRespond, physicianId, compact = false }) {
  const assigned = !physicianId || item.physician_id === physicianId
  return <div className={`doctor-session-row ${compact ? 'doctor-session-compact' : ''}`}><div className="doctor-session-day"><strong>{dateText(item.session_date, { day: 'numeric' })}</strong><span>{dateText(item.session_date, { month: 'short', weekday: 'short' })}</span></div><div className="doctor-session-copy"><strong>{clinicName || 'คลินิก'}</strong><span><Clock3 size={13} />{timeText(item.start_time)}–{timeText(item.end_time)} น. <span className="middot">·</span> นัด {item.appointment_count}/{item.appointment_quota} <span className="middot">·</span> {remainingText(item)}</span></div>{item.session_status === 'cancelled' ? <span className="status-pill status-gray">งดตรวจ</span> : assigned ? <ResponseBadge status={item.doctor_response_status} /> : <span className="status-pill status-amber">มีแพทย์ทดแทน</span>}{assigned && item.doctor_response_status === 'pending' && item.session_status === 'scheduled' && <button className="text-button" onClick={() => onRespond(item)}>ตอบกลับ</button>}</div>
}

function BusyResponseModal({ session, clinicName, onClose, onSave }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (!note.trim()) { setError('กรุณาระบุหมายเหตุให้พยาบาลผู้ดูแลทราบ'); return }
    setSaving(true); setError('')
    try { await onSave(note.trim()) } catch { setError('ส่งข้อมูลไม่สำเร็จ ลองอีกครั้ง'); setSaving(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true"><button className="modal-close icon-button" onClick={onClose}><X size={18} /></button><div className="eyebrow">แจ้งพยาบาลผู้ดูแล</div><h2>แจ้งติดภารกิจ</h2><p>{clinicName} · {dateText(session.session_date, { weekday: 'long', day: 'numeric', month: 'long' })} · {timeText(session.start_time)} น.</p><div className="soft-warning"><AlertCircle size={17} /><span>การแจ้งนี้ยังไม่ยกเลิกรอบตรวจ พยาบาลผู้ดูแลจะเป็นผู้บันทึกผลการจัดการ</span></div><label className="modal-label">หมายเหตุ<textarea rows="3" maxLength={500} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="ระบุข้อมูลที่ต้องการแจ้งพยาบาล" /><small className="note-privacy">บันทึกเฉพาะเหตุขัดข้อง · ไม่ใส่ชื่อหรือข้อมูลผู้ป่วย</small></label>{error && <div className="inline-error"><AlertCircle size={16} />{error}</div>}<div className="modal-actions"><button className="button button-quiet" onClick={onClose}>กลับ</button><button className="button button-primary" disabled={saving} onClick={submit}><AlertCircle size={16} />{saving ? 'กำลังส่ง…' : 'แจ้งติดภารกิจ'}</button></div></section></div>
}

function NotificationCenter({ notifications, refresh }) {
  useEffect(() => {
    const listener = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    window.addEventListener('go-notifications', listener)
    return () => window.removeEventListener('go-notifications', listener)
  }, [])
  async function markRead(notification) {
    if (notification.read_at) return
    await apiClient.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id)
    refresh()
  }
  async function markAll() {
    const unread = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unread.length) await apiClient.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread)
    refresh()
  }
  const unread = notifications.filter((n) => !n.read_at).length
  return <><PageTitle eyebrow="ศูนย์ข้อความ" title="การแจ้งเตือน" description="การเตือนจะแสดงในเว็บเมื่อคุณเปิดหน้าเว็บตามช่วง 7, 3 และ 1 วันก่อนตรวจ" action={unread > 0 && <button className="button button-outline" onClick={markAll}><CheckCheck size={16} />อ่านทั้งหมด</button>} />
    <div className="notification-explainer"><span><Bell size={18} /></span><div><strong>แจ้งเตือนในเว็บเท่านั้น</strong><p>ไม่มีการส่ง Push หรือ SMS · ควรเปิดเว็บเพื่อตรวจสอบเป็นประจำ และพยาบาลจะติดตามบัญชีที่ไม่ได้เข้าใช้งาน</p></div></div>
    <section className="panel notification-panel"><div className="panel-header"><div><h2>ทั้งหมด</h2><p>{unread} รายการยังไม่ได้อ่าน</p></div><span className="count-pill">{notifications.length}</span></div>
      <div className="notification-list">{notifications.map((n) => <button className={`notification-row ${!n.read_at ? 'notification-unread' : ''}`} key={n.id} onClick={() => markRead(n)}><div className={`notification-icon ${n.kind.startsWith('reminder') ? 'reminder-icon' : 'update-icon'}`}><Bell size={18} /></div><div className="notification-copy"><div><strong>{n.title}</strong>{!n.read_at && <i className="unread-dot" />}</div><p>{n.body}</p><span>{dateTimeText(n.created_at)}</span></div><div className="notification-state">{n.read_at ? <Check size={16} /> : <span>ใหม่</span>}</div></button>)}
        {!notifications.length && <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" description="เมื่อมีรอบตรวจใกล้ถึงวัน ระบบจะแจ้งเตือนที่นี่เมื่อคุณเปิดเว็บ" />}</div>
    </section></>
}

function ResponseBadge({ status }) {
  const label = responseLabel(status)
  return <span className={`response-badge response-${status || 'pending'}`}><i />{label}</span>
}
function responseLabel(status) { return status === 'confirmed' ? 'ยืนยันแล้ว' : status === 'busy' ? 'ติดภารกิจ' : 'รอยืนยัน' }
function EmptyState({ icon: Icon, title, description }) { return <div className="empty-state"><div><Icon size={21} /></div><strong>{title}</strong><span>{description}</span></div> }

async function generateNextSessions(refresh) {
  const { data, error } = await apiClient.rpc('generate_schedule_sessions', { p_from: today(), p_to: addDays(today(), 90) })
  if (error) window.alert(error.message || 'สร้างรอบตรวจไม่สำเร็จ')
  else { window.alert(`สร้างรอบตรวจใหม่ ${data ?? 0} รายการ · รอบที่มีอยู่แล้วจะไม่ถูกสร้างซ้ำ`); await refresh() }
}

export default App

