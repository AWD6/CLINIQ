const APP = {
  timezone: 'Asia/Bangkok',
  properties: PropertiesService.getScriptProperties(),
  sheets: {
    clinics: 'Clinics', physicians: 'Physicians', users: 'Users', user_profiles: 'Users',
    schedule_templates: 'ScheduleTemplates', schedule_sessions: 'Sessions',
    notifications: 'Notifications', activity_events: 'ActivityEvents',
  },
  headers: {
    Clinics: ['id','name','short_name','is_active','created_at'],
    Physicians: ['id','display_name','is_placeholder','is_active','notes','created_at','updated_at'],
    Users: ['id','email','display_name','role','physician_id','is_active','last_active_at','created_at'],
    ScheduleTemplates: ['id','clinic_id','physician_id','weekday','week_of_month','start_time','end_time','appointment_quota','effective_from','effective_until','is_active','admin_note','created_at','updated_at'],
    Sessions: ['id','source_template_id','clinic_id','physician_id','replaces_physician_id','session_date','start_time','end_time','appointment_quota','appointment_count','appointment_updated_at','session_status','cancellation_reason','doctor_response_status','doctor_response_note','doctor_responded_at','admin_resolution_note','resolved_by','resolved_at','created_by','created_at','updated_at'],
    Notifications: ['id','user_id','physician_id','session_id','kind','title','body','created_at','read_at'],
    ActivityEvents: ['id','actor_id','actor_name','action','entity_type','entity_id','details','created_at'],
  },
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Clinic Schedule Data Bridge')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiCall(action, payload, credential) {
  try {
    if (action === 'directory') return { data: publicPhysicians_() };
    if (action === 'start') return { data: startRoleSession_(payload || {}) };
    const identity = verifySessionToken_(credential);
    const user = getAuthorizedUser_(identity);
    touchLastActive_(user);
    generateDueNotifications_(user);
    if (action === 'query') return { data: query_(user, payload || {}) };
    if (action === 'rpc') return { data: rpc_(user, payload || {}) };
    throw new Error('ไม่รู้จักคำสั่งนี้');
  } catch (error) {
    return { error: String(error && error.message ? error.message : error) };
  }
}

function publicPhysicians_() {
  return records_('Physicians').filter(function(row) { return row.is_active && !row.is_placeholder; })
    .map(function(row) { return { id: row.id, display_name: row.display_name }; })
    .sort(function(a,b) { return a.display_name.localeCompare(b.display_name, 'th'); });
}

// Role selection creates a short server-signed session; it does not verify a person's identity.
function startRoleSession_(request) {
  const role = String(request.role || '');
  let user;
  if (role === 'admin') {
    user = records_('Users').find(function(row) { return row.role === 'admin' && row.is_active; });
    if (!user) throw new Error('ยังไม่มีผู้ดูแลในชีต Users กรุณาให้ผู้ดูแลเพิ่มข้อมูลก่อน');
  } else if (role === 'physician') {
    const physicianId = String(request.physician_id || '');
    const physician = records_('Physicians').find(function(row) { return row.id === physicianId && row.is_active && !row.is_placeholder; });
    if (!physician) throw new Error('ไม่พบชื่อแพทย์ที่เลือก หรือชื่อนี้ยังรอยืนยัน');
    user = records_('Users').find(function(row) { return row.role === 'physician' && row.physician_id === physicianId; });
    if (user && !user.is_active) throw new Error('ข้อมูลแพทย์นี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล');
    if (!user) {
      user = {
        id: 'mode-physician-' + physician.id,
        display_name: physician.display_name,
        role: 'physician', physician_id: physician.id, is_active: true,
        last_active_at: null, created_at: new Date().toISOString(),
      };
      appendRecord_('Users', user);
    }
  } else {
    throw new Error('กรุณาเลือกหน้าใช้งาน');
  }

  if (!user.id) {
    user.id = role === 'admin' ? 'mode-admin' : 'mode-physician-' + user.physician_id;
    writeFields_('Users', user._row, { id: user.id });
  }
  const identity = { sub: String(user.id) };
  return { profile: publicUser_(user), sessionToken: issueSessionToken_(identity) };
}

function issueSessionToken_(identity) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode_(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = base64UrlEncode_(JSON.stringify({ iss: 'clinic-schedule-appscript', sub: identity.sub, iat: now, exp: now + 8 * 60 * 60 }));
  const signingInput = header + '.' + claims;
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(signingInput, sessionSecret_)).replace(/=+$/, '');
  return signingInput + '.' + signature;
}

function verifySessionToken_(token) {
  if (!token) throw new Error('กรุณาเลือกหน้าใช้งานใหม่');
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('session ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
  const input = parts[0] + '.' + parts[1];
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(input, sessionSecret_)).replace(/=+$/, '');
  if (!constantTimeEqual_(parts[2], expected)) throw new Error('session ไม่ถูกต้อง กรุณาเลือกหน้าใช้งานใหม่');
  let header; let claims;
  try {
    header = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  } catch (_) { throw new Error('session ไม่ถูกต้อง กรุณาเลือกหน้าใช้งานใหม่'); }
  if (header.alg !== 'HS256' || claims.iss !== 'clinic-schedule-appscript' || Number(claims.exp) <= Math.floor(Date.now() / 1000) || !claims.sub) {
    throw new Error('session หมดอายุ กรุณาเลือกหน้าใช้งานใหม่');
  }
  return { sub: String(claims.sub) };
}

function sessionSecret_() {
  let secret = APP.properties.getProperty('SESSION_HMAC_SECRET');
  if (!secret) {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      secret = APP.properties.getProperty('SESSION_HMAC_SECRET');
      if (!secret) {
        secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
        APP.properties.setProperty('SESSION_HMAC_SECRET', secret);
      }
    } finally { lock.releaseLock(); }
  }
  return secret;
}

function base64UrlEncode_(value) { return Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8).replace(/=+$/, ''); }
function constantTimeEqual_(left, right) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

function getAuthorizedUser_(identity) {
  const users = records_('Users');
  const match = users.find(function(row) { return String(row.id || '') === identity.sub; });
  if (!match || match.is_active !== true) throw new Error('ไม่พบหน้าใช้งานนี้ กรุณาเลือกใหม่');
  if (!['admin','physician'].includes(match.role)) throw new Error('บัญชีนี้ไม่มีบทบาทที่ใช้งานได้');
  if (match.role === 'physician' && !match.physician_id) throw new Error('ไม่พบข้อมูลแพทย์ กรุณาเลือกชื่อใหม่');
  if (match.id && String(match.id) !== identity.sub) throw new Error('ข้อมูล session ไม่ตรงกับหน้าใช้งานที่เลือก');
  if (!match.id) writeFields_('Users', match._row, { id: identity.sub });
  match.id = identity.sub;
  return match;
}

function publicUser_(row) {
  return { id: row.id, display_name: row.display_name, role: row.role, physician_id: row.physician_id || null, is_active: row.is_active === true, last_active_at: row.last_active_at || null };
}

function touchLastActive_(user) {
  const now = new Date();
  const last = user.last_active_at ? new Date(user.last_active_at) : null;
  if (!last || now.getTime() - last.getTime() > 5 * 60 * 1000) {
    writeFields_('Users', user._row, { last_active_at: now.toISOString() });
    user.last_active_at = now.toISOString();
  }
}

function query_(user, request) {
  const table = request.table;
  const operation = request.operation || 'select';
  if (!APP.sheets[table]) throw new Error('ตารางนี้ไม่ได้เปิดให้เรียกใช้');
  if (operation === 'insert') return insert_(user, table, request.values);
  if (operation === 'update') return update_(user, table, request.values || {}, request.filters || []);
  if (operation !== 'select') throw new Error('คำสั่งข้อมูลนี้ไม่ได้รับอนุญาต');
  let rows = readableRows_(user, table).filter(function(row) { return filtersMatch_(row, request.filters || []); });
  (request.orders || []).slice().reverse().forEach(function(order) {
    rows.sort(function(a,b) {
      const left = comparable_(a[order.column]); const right = comparable_(b[order.column]);
      return (left < right ? -1 : left > right ? 1 : 0) * (order.ascending === false ? -1 : 1);
    });
  });
  const max = Math.min(1000, Math.max(1, Number(request.limit || 1000)));
  rows = rows.slice(0, max).map(function(row) { return table === 'user_profiles' ? publicUser_(row) : stripInternal_(row); });
  return request.maybeSingle ? (rows[0] || null) : rows;
}

function readableRows_(user, table) {
  let rows = records_(APP.sheets[table]);
  if (user.role === 'admin') return rows;
  if (table === 'clinics') return rows.filter(function(row) { return row.is_active; });
  if (table === 'physicians') return rows.filter(function(row) { return row.id === user.physician_id; });
  if (table === 'user_profiles') return rows.filter(function(row) { return row.id === user.id; });
  if (table === 'schedule_templates') return rows.filter(function(row) { return row.physician_id === user.physician_id; });
  if (table === 'schedule_sessions') return rows.filter(function(row) { return row.physician_id === user.physician_id || row.replaces_physician_id === user.physician_id; });
  if (table === 'notifications') return rows.filter(function(row) { return row.user_id === user.id || row.physician_id === user.physician_id; });
  throw new Error('บัญชีแพทย์ไม่มีสิทธิ์อ่านข้อมูลส่วนนี้');
}

function filtersMatch_(row, filters) {
  return filters.every(function(filter) {
    const value = row[filter.column];
    if (filter.op === 'eq') return comparable_(value) === comparable_(filter.value);
    if (filter.op === 'gte') return comparable_(value) >= comparable_(filter.value);
    if (filter.op === 'lte') return comparable_(value) <= comparable_(filter.value);
    if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.map(comparable_).includes(comparable_(value));
    return false;
  });
}

function comparable_(value) { return value == null ? '' : String(value).toLowerCase(); }

function insert_(user, table, values) {
  requireAdmin_(user);
  const list = Array.isArray(values) ? values : [values];
  const allowed = {
    clinics: ['name','short_name','is_active'],
    physicians: ['display_name','is_placeholder','is_active','notes'],
    schedule_templates: ['clinic_id','physician_id','weekday','week_of_month','start_time','end_time','appointment_quota','effective_from','effective_until','is_active','admin_note'],
  }[table];
  if (!allowed) throw new Error('ไม่อนุญาตให้เพิ่มแถวในตารางนี้');
  const sheetName = APP.sheets[table];
  const created = [];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    list.forEach(function(input) {
      const row = pickFields_(input || {}, allowed);
      if (table === 'clinics') { row.id = Utilities.getUuid(); row.is_active = row.is_active !== false; row.created_at = new Date().toISOString(); }
      if (table === 'physicians') { row.id = Utilities.getUuid(); row.is_active = row.is_active !== false; row.is_placeholder = row.is_placeholder === true; row.created_at = new Date().toISOString(); row.updated_at = row.created_at; }
      if (table === 'schedule_templates') {
        const duplicate = records_('ScheduleTemplates').some(function(item) { return item.clinic_id === row.clinic_id && item.physician_id === row.physician_id && Number(item.weekday) === Number(row.weekday) && Number(item.week_of_month) === Number(row.week_of_month) && item.is_active; });
        if (duplicate) throw new Error('มีตารางประจำรายการนี้อยู่แล้ว');
        row.id = Utilities.getUuid(); row.is_active = true; row.created_at = new Date().toISOString(); row.updated_at = row.created_at; row.effective_until = row.effective_until || null; row.admin_note = row.admin_note || '';
      }
      validateRecord_(table, row, null);
      appendRecord_(sheetName, row);
      logEvent_(user, 'insert', sheetName, row.id, null, row);
      created.push(stripInternal_(row));
    });
  } finally { lock.releaseLock(); }
  return created;
}

function update_(user, table, patch, filters) {
  if (!filters.length) throw new Error('การแก้ไขต้องระบุเงื่อนไขแถว');
  let allowed;
  if (table === 'user_profiles') {
    allowed = ['last_active_at'];
    if (Object.keys(patch).some(function(key) { return key !== 'last_active_at'; })) throw new Error('อนุญาตให้อัปเดตได้เฉพาะเวลาเข้าใช้');
  } else if (table === 'notifications') {
    allowed = ['read_at'];
    if (Object.keys(patch).some(function(key) { return key !== 'read_at'; })) throw new Error('แก้ไขได้เฉพาะสถานะอ่านแล้ว');
  } else {
    requireAdmin_(user);
    allowed = {
      clinics: ['name','short_name','is_active'],
      physicians: ['display_name','is_placeholder','is_active','notes'],
      schedule_templates: ['appointment_quota','start_time','end_time','is_active','effective_until','admin_note'],
      schedule_sessions: ['appointment_quota','appointment_count','session_status','cancellation_reason','doctor_response_status','doctor_response_note','doctor_responded_at','admin_resolution_note','resolved_by','resolved_at','physician_id','replaces_physician_id'],
    }[table];
    if (!allowed) throw new Error('ไม่อนุญาตให้แก้ไขตารางนี้');
  }
  const safePatch = pickFields_(patch, allowed);
  if (!Object.keys(safePatch).length) throw new Error('ไม่มีข้อมูลที่อนุญาตให้แก้ไข');
  const sheetName = APP.sheets[table];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let current = [];
  try {
    current = records_(sheetName).filter(function(row) { return filtersMatch_(row, filters) && canChangeRow_(user, table, row); });
    current.forEach(function(row) {
      const old = stripInternal_(row);
      const changes = Object.assign({}, safePatch);
      if (['clinics','physicians','schedule_templates','schedule_sessions'].includes(table)) validateRecord_(table, Object.assign({}, row, changes), row);
      if (['clinics','physicians','schedule_templates','schedule_sessions'].includes(table)) changes.updated_at = new Date().toISOString();
      if (table === 'schedule_sessions' && ('appointment_count' in changes || 'appointment_quota' in changes)) changes.appointment_updated_at = new Date().toISOString();
      writeFields_(sheetName, row._row, changes);
      const next = Object.assign({}, old, changes);
      logEvent_(user, 'update', sheetName, row.id, old, next);
      if (table === 'schedule_sessions' && old.physician_id !== next.physician_id) notifyAssignment_(next);
    });
  } finally { lock.releaseLock(); }
  return current.map(function(row) { return Object.assign(stripInternal_(row), safePatch); });
}

function canChangeRow_(user, table, row) {
  if (user.role === 'admin') return true;
  if (table === 'user_profiles') return row.id === user.id;
  if (table === 'notifications') return row.user_id === user.id || row.physician_id === user.physician_id;
  return false;
}

function rpc_(user, request) {
  const args = request.args || {};
  if (request.name === 'load_workspace') return loadWorkspace_(user);
  if (request.name === 'touch_last_active') { touchLastActive_(user); return null; }
  if (request.name === 'generate_due_notifications') { generateDueNotifications_(user); return null; }
  if (request.name === 'generate_schedule_sessions') {
    requireAdmin_(user);
    return generateSessions_(user, args.p_from || bangkokToday_(), args.p_to || addDays_(bangkokToday_(), 90));
  }
  if (request.name === 'respond_to_session') return respondToSession_(user, args.p_session_id, args.p_response, args.p_note);
  throw new Error('ไม่รู้จักคำสั่งนี้');
}

function loadWorkspace_(user) {
  const clinics = readableRows_(user, 'clinics');
  const physicians = readableRows_(user, 'physicians');
  const allSessions = readableRows_(user, 'schedule_sessions');
  const today = bangkokToday_();
  let start; let end;
  if (user.role === 'admin') { start = addDays_(today, -30); end = addDays_(today, 180); }
  else {
    const monthFirst = today.slice(0,7) + '-01';
    start = addDays_(monthFirst, -35);
    const futureMonth = new Date(monthFirst + 'T12:00:00Z'); futureMonth.setUTCMonth(futureMonth.getUTCMonth() + 5);
    end = addDays_(Utilities.formatDate(futureMonth, 'UTC', 'yyyy-MM-01'), 35);
  }
  const sessions = allSessions.filter(function(row) { return row.session_date >= start && row.session_date <= end; })
    .sort(function(a,b) { return (a.session_date + a.start_time).localeCompare(b.session_date + b.start_time); })
    .slice(0, user.role === 'admin' ? 1000 : 500).map(stripInternal_);
  const notifications = readableRows_(user, 'notifications').sort(function(a,b) { return String(b.created_at).localeCompare(String(a.created_at)); }).slice(0,100).map(stripInternal_);
  if (user.role === 'admin') {
    return {
      clinics: clinics.map(stripInternal_), physicians: physicians.map(stripInternal_),
      templates: readableRows_(user, 'schedule_templates').sort(function(a,b) { return Number(a.weekday)-Number(b.weekday) || String(a.start_time).localeCompare(String(b.start_time)); }).map(stripInternal_),
      sessions: sessions, notifications: notifications,
      events: records_('ActivityEvents').sort(function(a,b) { return String(b.created_at).localeCompare(String(a.created_at)); }).slice(0,100).map(stripInternal_),
      profiles: records_('Users').map(publicUser_),
    };
  }
  return { clinics: clinics.map(stripInternal_), physicians: physicians.map(stripInternal_), templates: [], sessions: sessions, notifications: notifications, events: [], profiles: [] };
}

function generateSessions_(user, fromDate, toDate) {
  if (fromDate > toDate || fromDate < '2000-01-01' || toDate > addDays_(fromDate, 370)) throw new Error('ช่วงวันที่สร้างรอบตรวจไม่ถูกต้อง');
  let count = 0;
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const activeClinics = new Set(records_('Clinics').filter(function(row) { return row.is_active; }).map(function(row) { return row.id; }));
    const activePhysicians = new Set(records_('Physicians').filter(function(row) { return row.is_active; }).map(function(row) { return row.id; }));
    const templates = records_('ScheduleTemplates').filter(function(t) { return t.is_active && activeClinics.has(t.clinic_id) && activePhysicians.has(t.physician_id) && t.effective_from <= toDate && (!t.effective_until || t.effective_until >= fromDate); });
    const existing = new Set(records_('Sessions').filter(function(s) { return s.source_template_id; }).map(function(s) { return s.source_template_id + '|' + s.session_date; }));
    const cursor = new Date(fromDate + 'T12:00:00Z');
    const end = new Date(toDate + 'T12:00:00Z');
    while (cursor <= end) {
      const date = Utilities.formatDate(cursor, 'UTC', 'yyyy-MM-dd');
      const weekday = cursor.getUTCDay();
      const weekOfMonth = Math.ceil(Number(date.slice(8,10)) / 7);
      templates.filter(function(t) { return Number(t.weekday) === weekday && (!Number(t.week_of_month) || Number(t.week_of_month) === weekOfMonth) && t.effective_from <= date && (!t.effective_until || t.effective_until >= date); }).forEach(function(template) {
        const key = template.id + '|' + date;
        if (existing.has(key)) return;
        const now = new Date().toISOString();
        const row = { id: Utilities.getUuid(), source_template_id: template.id, clinic_id: template.clinic_id, physician_id: template.physician_id, replaces_physician_id: null, session_date: date, start_time: template.start_time, end_time: template.end_time, appointment_quota: Number(template.appointment_quota || 0), appointment_count: 0, appointment_updated_at: now, session_status: 'scheduled', cancellation_reason: null, doctor_response_status: 'pending', doctor_response_note: null, doctor_responded_at: null, admin_resolution_note: null, resolved_by: null, resolved_at: null, created_by: user.id, created_at: now, updated_at: now };
        appendRecord_('Sessions', row); existing.add(key); count++;
        logEvent_(user, 'insert', 'Sessions', row.id, null, row);
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } finally { lock.releaseLock(); }
  return count;
}

function generateDueNotifications_(user) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const today = bangkokToday_();
    const sessions = records_('Sessions').filter(function(row) { return row.session_status === 'scheduled' && row.session_date >= today; });
    const users = records_('Users').filter(function(row) { return row.role === 'physician' && row.is_active && row.physician_id; });
    const existing = new Set(records_('Notifications').map(function(n) { return n.user_id + '|' + n.session_id + '|' + n.kind; }));
    sessions.forEach(function(session) {
      const days = Math.round((new Date(session.session_date + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000);
      if (![7,3,1].includes(days)) return;
      const targetUsers = users.filter(function(item) { return item.physician_id === session.physician_id; });
      targetUsers.forEach(function(target) {
        const kind = 'reminder_' + days;
        const key = target.id + '|' + session.id + '|' + kind;
        if (existing.has(key)) return;
        appendRecord_('Notifications', { id: Utilities.getUuid(), user_id: target.id, physician_id: target.physician_id, session_id: session.id, kind: kind, title: 'ยืนยันรอบตรวจในอีก ' + days + ' วัน', body: 'กรุณาตรวจสอบตารางออกตรวจและแจ้งพยาบาลผู้ดูแลหากติดภารกิจ', created_at: new Date().toISOString(), read_at: null });
        existing.add(key);
      });
    });
  } finally { lock.releaseLock(); }
}

function respondToSession_(user, sessionId, response, note) {
  if (user.role !== 'physician') throw new Error('รายการนี้สำหรับแพทย์');
  if (!['confirmed','busy'].includes(response)) throw new Error('สถานะตอบกลับไม่ถูกต้อง');
  if (response === 'busy' && !String(note || '').trim()) throw new Error('กรุณาระบุหมายเหตุ');
  const cleanNote = String(note || '').trim();
  if (cleanNote.length > 500) throw new Error('หมายเหตุยาวเกิน 500 ตัวอักษร');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const session = records_('Sessions').find(function(row) { return row.id === sessionId; });
    if (!session || session.physician_id !== user.physician_id) throw new Error('ไม่พบรอบตรวจหรือไม่มีสิทธิ์ตอบกลับ');
    if (session.session_status !== 'scheduled') throw new Error('รอบตรวจนี้ถูกงดตรวจแล้ว');
    const old = stripInternal_(session);
    const updated = { doctor_response_status: response, doctor_response_note: cleanNote || null, doctor_responded_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    writeFields_('Sessions', session._row, updated);
    logEvent_(user, 'update', 'Sessions', session.id, old, Object.assign({}, old, updated));
  } finally { lock.releaseLock(); }
  return null;
}

function notifyAssignment_(session) {
  const targets = records_('Users').filter(function(row) { return row.role === 'physician' && row.physician_id === session.physician_id && row.is_active; });
  targets.forEach(function(target) {
    appendRecord_('Notifications', { id: Utilities.getUuid(), user_id: target.id, physician_id: target.physician_id, session_id: session.id, kind: 'assignment_changed', title: 'มีการเปลี่ยนแปลงรอบตรวจ', body: 'พยาบาลผู้ดูแลปรับข้อมูลผู้รับผิดชอบรอบตรวจ กรุณาเปิดตารางเพื่อตรวจสอบ', created_at: new Date().toISOString(), read_at: null });
  });
}

function logEvent_(user, action, entity, id, oldValue, newValue) {
  appendRecord_('ActivityEvents', { id: Utilities.getUuid(), actor_id: user.id, actor_name: user.display_name, action: action, entity_type: entity, entity_id: id, details: JSON.stringify({ old: oldValue || {}, new: newValue || {} }), created_at: new Date().toISOString() });
}

function requireAdmin_(user) { if (user.role !== 'admin') throw new Error('ต้องใช้สิทธิ์พยาบาลผู้ดูแล'); }
function pickFields_(object, allowed) { const output = {}; Object.keys(object || {}).forEach(function(key) { if (allowed.includes(key)) output[key] = object[key]; }); return output; }
function validateRecord_(table, row, previous) {
  const rows = records_(APP.sheets[table]);
  if (table === 'clinics') {
    if (!String(row.name || '').trim() || !String(row.short_name || '').trim() || String(row.name).length > 100) throw new Error('กรุณาระบุชื่อคลินิกและชื่อย่อให้ถูกต้อง');
    if (rows.some(function(item) { return item.id !== row.id && String(item.name).toLowerCase() === String(row.name).toLowerCase(); })) throw new Error('มีชื่อคลินิกนี้อยู่แล้ว');
  }
  if (table === 'physicians') {
    if (!String(row.display_name || '').trim() || String(row.display_name).length > 150) throw new Error('กรุณาระบุชื่อแพทย์ไม่เกิน 150 ตัวอักษร');
    if (rows.some(function(item) { return item.id !== row.id && String(item.display_name).toLowerCase() === String(row.display_name).toLowerCase(); })) throw new Error('มีข้อมูลแพทย์ชื่อนี้อยู่แล้ว');
  }
  if (table === 'schedule_templates') {
    const weekday = Number(row.weekday); const week = Number(row.week_of_month); const quota = Number(row.appointment_quota);
    if (!records_('Clinics').some(function(item) { return item.id === row.clinic_id; }) || !records_('Physicians').some(function(item) { return item.id === row.physician_id; })) throw new Error('เลือกคลินิกและแพทย์ที่มีอยู่ในระบบ');
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !Number.isInteger(week) || week < 0 || week > 5) throw new Error('วันหรือสัปดาห์ประจำไม่ถูกต้อง');
    if (!Number.isInteger(quota) || quota < 0 || !validTime_(row.start_time) || !validTime_(row.end_time) || String(row.start_time) >= String(row.end_time)) throw new Error('เวลาออกตรวจหรือโควตาไม่ถูกต้อง');
    if (!validDate_(row.effective_from) || (row.effective_until && (!validDate_(row.effective_until) || row.effective_until < row.effective_from))) throw new Error('ช่วงวันที่มีผลของตารางไม่ถูกต้อง');
    if (rows.some(function(item) { return item.id !== row.id && item.clinic_id === row.clinic_id && item.physician_id === row.physician_id && Number(item.weekday) === weekday && Number(item.week_of_month) === week; })) throw new Error('มีตารางประจำรายการนี้อยู่แล้ว');
  }
  if (table === 'schedule_sessions') {
    const quota = Number(row.appointment_quota); const count = Number(row.appointment_count);
    if (!Number.isInteger(quota) || quota < 0 || !Number.isInteger(count) || count < 0 || count > 100000) throw new Error('ยอดนัดหรือโควตาไม่ถูกต้อง');
    if (!['scheduled','cancelled'].includes(row.session_status) || !['pending','confirmed','busy'].includes(row.doctor_response_status)) throw new Error('สถานะรอบตรวจไม่ถูกต้อง');
    ['cancellation_reason','doctor_response_note','admin_resolution_note'].forEach(function(key) { if (row[key] && String(row[key]).length > 500) throw new Error('หมายเหตุยาวเกิน 500 ตัวอักษร'); });
  }
}
function validTime_(value) { return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value || '')); }
function validDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !isNaN(date.getTime()) && Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd') === value;
}
function stripInternal_(row) { const copy = Object.assign({}, row); delete copy._row; if (copy.details && typeof copy.details === 'string') { try { copy.details = JSON.parse(copy.details); } catch (_) {} } return copy; }

function getSheet_(name) {
  const id = APP.properties.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('ยังไม่ได้สร้าง Google Sheet กรุณารัน setupSpreadsheet()');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบแท็บ ' + name + ' กรุณารัน setupSpreadsheet()');
  return sheet;
}

function records_(name) {
  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const values = sheet.getRange(2,1,lastRow-1,headers.length).getValues();
  return values.map(function(line, index) {
    const row = { _row: index + 2 };
    headers.forEach(function(key, column) { row[key] = parseCell_(key, line[column]); });
    return row;
  }).filter(function(row) { return row.id || row.email || (name === 'Users' && row.display_name && row.role); });
}

function parseCell_(key, value) {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  if (value instanceof Date) {
    if (key.endsWith('_at')) return value.toISOString();
    if (key.endsWith('_date') || ['effective_from','effective_until'].includes(key)) return Utilities.formatDate(value, APP.timezone, 'yyyy-MM-dd');
    if (key.endsWith('_time') || key === 'start_time' || key === 'end_time') return Utilities.formatDate(value, APP.timezone, 'HH:mm:ss');
  }
  if (['is_active','is_placeholder'].includes(key)) return value === true || String(value).toUpperCase() === 'TRUE';
  if (['weekday','week_of_month','appointment_quota','appointment_count'].includes(key)) return Number(value) || 0;
  return value;
}

function appendRecord_(name, record) {
  const sheet = getSheet_(name);
  const headers = APP.headers[name];
  if (!headers) throw new Error('ไม่มีโครงสร้างคอลัมน์ของ ' + name);
  const line = headers.map(function(key) { return safeSheetValue_(record[key]); });
  sheet.appendRow(line);
}

function writeFields_(name, rowNumber, fields) {
  const sheet = getSheet_(name);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  Object.keys(fields).forEach(function(key) {
    const column = headers.indexOf(key);
    if (column >= 0) sheet.getRange(rowNumber, column + 1).setValue(safeSheetValue_(fields[key]));
  });
}

function safeSheetValue_(value) {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function bangkokToday_() { return Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd'); }
function addDays_(dateString, amount) { const date = new Date(dateString + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + amount); return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd'); }
