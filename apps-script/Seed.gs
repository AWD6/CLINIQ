// Sample schedule read from IMG_5287.jpeg in the referenced conversation.
// Unclear names remain explicit placeholders. Quota 20 is for demonstration only.
function seedDemoData() {
  const clinics = [
    ['ต่อมไร้ท่อ','ต่อมไร้ท่อ'], ['ระบบไต','ไต'], ['หัวใจ','หัวใจ'],
    ['กระดูก','กระดูก'], ['ผู้สูงอายุ','ผู้สูงอายุ'], ['ศัลยกรรม','ศัลยกรรม'],
  ];
  const doctors = [
    ['ศ.ดร.พญ.วรพกา',false], ['รศ.พญ.ศุภวรรณ',false], ['รศ.พญ.เมตตาภรณ์',false], ['พญ.พีรพร',false],
    ['นพ.วิศวะ',false], ['นพ.ณัฐวุฒิ',false], ['นพ.ยุติธรรม',false], ['นพ.ดิเรก',false],
    ['ผศ.นพ.สุรเชษฐ์',false], ['นพ.ภูมิ',false], ['รศ.ดร.นพ.พิชิตชัย',false], ['รศ.นพ.ศรัณย์',false],
    ['ผศ.นพ.กฤษณ์',false], ['นพ.ปาณัสมี',false], ['พญ.จิตสุภา',false], ['ผศ.พญ.ปัญจพร',false],
    ['[รอยืนยันชื่อ] ต่อมไร้ท่อ จันทร์ 2',true], ['[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 1',true], ['[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 2',true],
    ['[รอยืนยันชื่อ] ระบบไต จันทร์ 1',true], ['[รอยืนยันชื่อ] ระบบไต จันทร์ 2',true], ['[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 1',true],
    ['[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 2',true], ['[รอยืนยันชื่อ] ระบบไต เสาร์ 1',true], ['[รอยืนยันชื่อ] หัวใจ จันทร์',true],
    ['[รอยืนยันชื่อ] หัวใจ อังคาร',true], ['[รอยืนยันชื่อ] หัวใจ เสาร์',true],
  ];
  const slots = [
    ['ต่อมไร้ท่อ','ศ.ดร.พญ.วรพกา',1,0], ['ต่อมไร้ท่อ','[รอยืนยันชื่อ] ต่อมไร้ท่อ จันทร์ 2',1,0],
    ['ต่อมไร้ท่อ','[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 1',2,0], ['ต่อมไร้ท่อ','[รอยืนยันชื่อ] ต่อมไร้ท่อ อังคาร 2',2,0],
    ['ต่อมไร้ท่อ','รศ.พญ.ศุภวรรณ',3,0], ['ต่อมไร้ท่อ','รศ.พญ.เมตตาภรณ์',4,0], ['ต่อมไร้ท่อ','พญ.พีรพร',5,1],
    ['ต่อมไร้ท่อ','นพ.วิศวะ',5,1], ['ต่อมไร้ท่อ','ศ.ดร.พญ.วรพกา',6,0], ['ต่อมไร้ท่อ','นพ.ณัฐวุฒิ',6,0],
    ['ระบบไต','[รอยืนยันชื่อ] ระบบไต จันทร์ 1',1,0], ['ระบบไต','[รอยืนยันชื่อ] ระบบไต จันทร์ 2',1,0],
    ['ระบบไต','นพ.ยุติธรรม',2,0], ['ระบบไต','นพ.ยุติธรรม',3,0], ['ระบบไต','[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 1',4,0],
    ['ระบบไต','[รอยืนยันชื่อ] ระบบไต พฤหัสบดี 2',4,0], ['ระบบไต','นพ.ดิเรก',5,0], ['ระบบไต','ผศ.นพ.สุรเชษฐ์',5,0],
    ['ระบบไต','[รอยืนยันชื่อ] ระบบไต เสาร์ 1',6,0], ['ระบบไต','นพ.ภูมิ',6,0],
    ['หัวใจ','[รอยืนยันชื่อ] หัวใจ จันทร์',1,0], ['หัวใจ','[รอยืนยันชื่อ] หัวใจ อังคาร',2,0],
    ['หัวใจ','รศ.นพ.ศรัณย์',4,0], ['หัวใจ','ผศ.นพ.กฤษณ์',4,0], ['หัวใจ','[รอยืนยันชื่อ] หัวใจ เสาร์',6,0],
    ['กระดูก','รศ.ดร.นพ.พิชิตชัย',1,0], ['กระดูก','รศ.ดร.นพ.พิชิตชัย',6,0],
    ['ผู้สูงอายุ','นพ.ปาณัสมี',3,0], ['ผู้สูงอายุ','นพ.ปาณัสมี',6,0], ['ผู้สูงอายุ','พญ.จิตสุภา',6,0],
    ['ศัลยกรรม','ผศ.พญ.ปัญจพร',1,0],
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
  doctors.forEach(function(item) {
    if (!doctorMap[item[0]]) {
      const row = { id: Utilities.getUuid(), display_name: item[0], is_placeholder: item[1], is_active: true, notes: item[1] ? 'ชื่ออ่านไม่ชัดจากภาพ ต้องให้พยาบาลผู้ดูแลยืนยัน' : 'ถอดชื่อจากตารางภาพ; ให้ผู้ดูแลยืนยันการสะกดและชื่อเต็ม', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      appendRecord_('Physicians', row); doctorMap[item[0]] = row.id;
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
