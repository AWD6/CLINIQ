function physicianDirectoryGroups_() {
  return [
    { clinicName: 'ต่อมไร้ท่อ', shortName: 'ต่อมไร้ท่อ', label: 'คลินิกต่อมไร้ท่อ (Endocrine)', color: 'violet', aliases: ['คลินิกต่อมไร้ท่อ','Endocrine'], doctors: [
      ['อ.วรผกา',['ศ.ดร.พญ.วรพกา']], ['อ.กฤตธี',[]], ['อ.นิพาวรรณ',[]], ['อ.สิทธิกุล',[]], ['อ.ศุภวรรณ',['รศ.พญ.ศุภวรรณ']], ['อ.เมตตาภรณ์',['รศ.พญ.เมตตาภรณ์']], ['อ.พิธพร',['พญ.พีรพร']], ['อ.วิศวะ',['นพ.วิศวะ']], ['อ.ณัฐวุฒิ',['นพ.ณัฐวุฒิ']],
    ]},
    { clinicName: 'ระบบไต', shortName: 'ไต', label: 'คลินิกไต (Nephro)', color: 'teal', aliases: ['คลินิกไต','Nephro'], doctors: [
      ['อ.ขจรศักดิ์',[]], ['อ.กานต์',[]], ['อ.ยุติธรรม',['นพ.ยุติธรรม']], ['อ.ดิเรก',['นพ.ดิเรก']], ['อ.สุรเชษฐ์',['ผศ.นพ.สุรเชษฐ์']], ['อ.ภูมิ',['นพ.ภูมิ']],
    ]},
    { clinicName: 'หัวใจ', shortName: 'หัวใจ', label: 'คลินิกหัวใจ (Cardio)', color: 'rose', aliases: ['คลินิกหัวใจ','Cardio'], doctors: [
      ['อ.ทรรศลักษณ์',[]], ['อ.ศรัณย์',['รศ.นพ.ศรัณย์']], ['อ.กฤษณ์',['ผศ.นพ.กฤษณ์']],
    ]},
    { clinicName: 'กระดูก', shortName: 'กระดูก', label: 'คลินิกกระดูก (Ortho)', color: 'amber', aliases: ['คลินิกกระดูก','Ortho'], doctors: [
      ['อ.พิชิตชัย',['รศ.ดร.นพ.พิชิตชัย']],
    ]},
    { clinicName: 'ผู้สูงอายุ', shortName: 'ผู้สูงอายุ', label: 'คลินิกผู้สูงอายุ', color: 'blue', aliases: ['คลินิกผู้สูงอายุ'], doctors: [
      ['อ.ปาณัสม์',['นพ.ปาณัสมี']], ['อ.จิตสุภา',['พญ.จิตสุภา']],
    ]},
    { clinicName: 'ศัลยกรรม', shortName: 'ศัลยกรรม', label: 'คลินิกศัลยกรรม (B&E)', color: 'cyan', aliases: ['คลินิกศัลยกรรม','B&E'], doctors: [
      ['อ.ปัญจพร',['ผศ.พญ.ปัญจพร']],
    ]},
  ];
}

function ensureDirectorySheet_(name) {
  const sheet = getSheet_(name);
  const headers = APP.headers[name];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const missing = headers.filter(function(header) { return !existing.includes(header); });
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function ensurePhysicianDirectory_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureDirectorySheet_('Clinics');
    ensureDirectorySheet_('Physicians');
    const groups = physicianDirectoryGroups_();
    const clinicRows = records_('Clinics');
    groups.forEach(function(group) {
      let clinic = clinicRows.find(function(row) {
        const name = String(row.name || '').trim().toLowerCase();
        const shortName = String(row.short_name || '').trim().toLowerCase();
        return name === group.clinicName.toLowerCase() || shortName === group.shortName.toLowerCase() || group.aliases.some(function(alias) { return name === alias.toLowerCase() || shortName === alias.toLowerCase(); });
      });
      if (!clinic) {
        clinic = { id: Utilities.getUuid(), name: group.clinicName, short_name: group.shortName, is_active: true, created_at: new Date().toISOString() };
        appendRecord_('Clinics', clinic);
        clinicRows.push(clinic);
      }
      group.clinic_id = clinic.id;
    });
    const physicians = records_('Physicians');
    const byName = {};
    physicians.forEach(function(row) { if (row.display_name) byName[String(row.display_name)] = row; });
    groups.forEach(function(group) {
      group.doctors.forEach(function(item) {
        const displayName = item[0];
        const aliases = item[1];
        const row = byName[displayName] || aliases.map(function(alias) { return byName[alias]; }).find(Boolean);
        const now = new Date().toISOString();
        if (row) {
          const id = row.id || Utilities.getUuid();
          const changes = {};
          if (!row.id) changes.id = id;
          if (row.display_name !== displayName) changes.display_name = displayName;
          if (row.is_placeholder == null) changes.is_placeholder = false;
          if (row.is_active == null) changes.is_active = true;
          if (row.clinic_id !== group.clinic_id) changes.clinic_id = group.clinic_id;
          if (!row.notes) changes.notes = 'รายชื่อที่ผู้ดูแลกำหนด';
          if (Object.keys(changes).length) { changes.updated_at = now; writeFields_('Physicians', row._row, changes); }
          delete byName[row.display_name];
          row.id = id; row.display_name = displayName; if (row.is_placeholder == null) row.is_placeholder = false; if (row.is_active == null) row.is_active = true; row.clinic_id = group.clinic_id;
          byName[displayName] = row;
        } else {
          const added = { id: Utilities.getUuid(), display_name: displayName, is_placeholder: false, is_active: true, notes: 'รายชื่อที่ผู้ดูแลกำหนด', created_at: now, updated_at: now, clinic_id: group.clinic_id };
          appendRecord_('Physicians', added);
          added._row = getSheet_('Physicians').getLastRow();
          byName[displayName] = added;
        }
      });
    });
    return groups;
  } finally {
    lock.releaseLock();
  }
}

// Sample schedule read from IMG_5287.jpeg in the referenced conversation.
// Unclear schedule slots remain placeholders; no days are inferred from the doctor list.
function seedDemoData() {
  const clinics = [
    ['ต่อมไร้ท่อ','ต่อมไร้ท่อ'], ['ระบบไต','ไต'], ['หัวใจ','หัวใจ'],
    ['กระดูก','กระดูก'], ['ผู้สูงอายุ','ผู้สูงอายุ'], ['ศัลยกรรม','ศัลยกรรม'],
  ];
  ensurePhysicianDirectory_();
  const doctors = [
    '[รอยืนยันชื่อ] ต่อมไร้ท่อ จันทร์ 2', '[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 1', '[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 2',
    '[รอยืนยันชื่อ] ระบบไต จันทร์ 1', '[รอยืนยันชื่อ] ระบบไต จันทร์ 2', '[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 1',
    '[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 2', '[รอยืนยันชื่อ] ระบบไต เสาร์ 1', '[รอยืนยันชื่อ] หัวใจ จันทร์',
    '[รอยืนยันชื่อ] หัวใจ อังคาร', '[รอยืนยันชื่อ] หัวใจ เสาร์',
  ];
  const slots = [
    ['ต่อมไร้ท่อ','อ.วรผกา',1,0], ['ต่อมไร้ท่อ','[รอยืนยันชื่อ] ต่อมไร้ท่อ จันทร์ 2',1,0],
    ['ต่อมไร้ท่อ','[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 1',2,0], ['ต่อมไร้ท่อ','[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 2',2,0],
    ['ต่อมไร้ท่อ','อ.ศุภวรรณ',3,0], ['ต่อมไร้ท่อ','อ.เมตตาภรณ์',4,0], ['ต่อมไร้ท่อ','อ.พิธพร',5,1],
    ['ต่อมไร้ท่อ','อ.วิศวะ',5,1], ['ต่อมไร้ท่อ','อ.วรผกา',6,0], ['ต่อมไร้ท่อ','อ.ณัฐวุฒิ',6,0],
    ['ระบบไต','[รอยืนยันชื่อ] ระบบไต จันทร์ 1',1,0], ['ระบบไต','[รอยืนยันชื่อ] ระบบไต จันทร์ 2',1,0],
    ['ระบบไต','อ.ยุติธรรม',2,0], ['ระบบไต','อ.ยุติธรรม',3,0], ['ระบบไต','[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 1',4,0],
    ['ระบบไต','[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 2',4,0], ['ระบบไต','อ.ดิเรก',5,0], ['ระบบไต','อ.สุรเชษฐ์',5,0],
    ['ระบบไต','[รอยืนยันชื่อ] ระบบไต เสาร์ 1',6,0], ['ระบบไต','อ.ภูมิ',6,0],
    ['หัวใจ','[รอยืนยันชื่อ] หัวใจ จันทร์',1,0], ['หัวใจ','[รอยืนยันชื่อ] หัวใจ อังคาร',2,0],
    ['หัวใจ','อ.ศรัณย์',4,0], ['หัวใจ','อ.กฤษณ์',4,0], ['หัวใจ','[รอยืนยันชื่อ] หัวใจ เสาร์',6,0],
    ['กระดูก','อ.พิชิตชัย',1,0], ['กระดูก','อ.พิชิตชัย',6,0],
    ['ผู้สูงอายุ','อ.ปาณัสม์',3,0], ['ผู้สูงอายุ','อ.ปาณัสม์',6,0], ['ผู้สูงอายุ','อ.จิตสุภา',6,0],
    ['ศัลยกรรม','อ.ปัญจพร',1,0],
  ];
  const clinicMap = {};
  records_('Clinics').forEach(function(row) { clinicMap[row.name] = row.id; });
  clinics.forEach(function(item) {
    if (!clinicMap[item[0]]) {
      const row = { id: Utilities.getUuid(), name: item[0], short_name: item[1], is_active: true, created_at: new Date().toISOString() };
      appendRecord_('Clinics', row); clinicMap[item[0]] = row.id;
    }
  });
  const doctorMap = {};
  records_('Physicians').forEach(function(row) { doctorMap[row.display_name] = row.id; });
  doctors.forEach(function(name) {
    if (!doctorMap[name]) {
      const row = { id: Utilities.getUuid(), display_name: name, is_placeholder: true, is_active: true, notes: 'ชื่ออ่านไม่ชัดจากภาพ ต้องให้ผู้ดูแลยืนยัน', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      appendRecord_('Physicians', row); doctorMap[name] = row.id;
    }
  });
  const templateRows = records_('ScheduleTemplates');
  slots.forEach(function(slot) {
    const existing = templateRows.some(function(row) { return row.clinic_id === clinicMap[slot[0]] && row.physician_id === doctorMap[slot[1]] && Number(row.weekday) === slot[2] && Number(row.week_of_month) === slot[3]; });
    if (existing) return;
    const saturday = slot[2] === 6;
    const row = { id: Utilities.getUuid(), clinic_id: clinicMap[slot[0]], physician_id: doctorMap[slot[1]], weekday: slot[2], week_of_month: slot[3], start_time: saturday ? '08:00:00' : '16:00:00', end_time: saturday ? '12:00:00' : '20:00:00', appointment_quota: 20, effective_from: bangkokToday_(), effective_until: null, is_active: true, admin_note: 'ตัวอย่าง: ยืนยันชื่อและโควตาก่อนใช้จริง', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    appendRecord_('ScheduleTemplates', row);
  });
}
