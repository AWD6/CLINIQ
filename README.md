# ระบบบริหารตารางคลินิกเฉพาะทางนอกเวลา

เว็บแอปภาษาไทยสำหรับพยาบาลผู้ดูแลและแพทย์ โรงพยาบาลมหาราชนครเชียงใหม่ ใช้ React/Vite เผยแพร่หน้าเว็บแบบ static บน GitHub Pages และเก็บข้อมูลใน Google Sheets ส่วน Apps Script ทำหน้าที่เป็น backend ตรวจสิทธิ์และอ่าน/เขียนชีต

## สถาปัตยกรรม

- GitHub Pages ให้บริการเฉพาะไฟล์หน้าเว็บ ไม่มีรหัสผ่านชีตหรือคีย์สิทธิ์สูงใน frontend
- Apps Script Web App ทำงานด้วยสิทธิ์บัญชีผู้ deploy และเป็นผู้เข้าถึง Spreadsheet
- แพทย์และผู้ดูแลเข้าสู่ระบบด้วย Google Identity Services บัญชีต้องถูกเพิ่มไว้ในแท็บ Users ก่อน
- ตอน login Apps Script ตรวจ Google ID token กับ Google tokeninfo และตรวจ audience, issuer, expiry, email verified; จากนั้นออก session ที่เซ็นด้วย HMAC ฝั่ง server ทุกคำขอถัดไปตรวจลายเซ็น session และอ่าน role/สถานะจาก Users ใหม่
- หน้าเว็บฝัง Apps Script bridge แบบซ่อนและเรียก backend ผ่าน google.script.run เพื่อลดปัญหา CORS ระหว่าง GitHub Pages กับ Apps Script
- ใช้เขตเวลา Asia/Bangkok และเก็บเฉพาะยอดนัดรวม ไม่มีชื่อหรือรหัสผู้ป่วย
- ไม่มีการเชื่อม HIS หรือดึงข้อมูลจากโรงพยาบาล

## ข้อจำกัดสำคัญของ Google Sheets

Google Sheets ไม่มี Row Level Security (RLS) ระดับฐานข้อมูลเหมือน PostgreSQL/Supabase ผู้ใช้ปลายทางจึงห้ามได้รับสิทธิ์แชร์ Spreadsheet โดยตรง ระบบนี้บังคับ role และกรองแถวใน Apps Script ฝั่ง server ก่อนอ่านหรือแก้ไขข้อมูล ซึ่งเป็นการควบคุมระดับแอป ไม่ใช่ RLS ของฐานข้อมูล เจ้าของชีตและผู้แก้ Apps Script ยังเข้าถึงข้อมูลทั้งหมดได้

เหมาะกับ MVP และทีมขนาดเล็กที่จำกัดสิทธิ์เจ้าของสคริปต์ได้ หากต้องการ RLS ที่ฐานข้อมูลบังคับจริง การทำงานพร้อมกันจำนวนมาก หรือการกำกับดูแลด้านความปลอดภัยระดับองค์กร ควรใช้ PostgreSQL/Supabase แทนชีต

## ฟังก์ชัน

- จัดการ 6 คลินิก: ต่อมไร้ท่อ, ระบบไต, หัวใจ, กระดูก, ผู้สูงอายุ และศัลยกรรม
- แยก ScheduleTemplates จากรอบตรวจ Sessions; สร้างรอบล่วงหน้า 90 วัน และสร้างซ้ำโดยไม่เพิ่มรายการเดิม
- กำหนดวันประจำสัปดาห์หรือสัปดาห์ที่เลือกของเดือน พร้อมเวลาและโควตา; ไม่ถือว่าทุกคลินิกเปิดทุกวัน
- เวลาตั้งต้น จันทร์–ศุกร์ 16:00–20:00 น. และเสาร์ 08:00–12:00 น.
- ผู้ดูแลบันทึกยอดนัดรวม, โควตา, งดตรวจ, แพทย์ทดแทน, ผลการจัดการกรณีติดภารกิจ, สถานะการยืนยัน, last active และประวัติแก้ไข
- แพทย์เห็นตารางของตนเองและรอบที่มีผู้ทดแทน พร้อมกดยืนยันหรือแจ้งติดภารกิจพร้อมหมายเหตุ
- การแจ้งติดภารกิจไม่ยกเลิกรอบหรือนัด ผู้ดูแลต้องบันทึกผลการจัดการเอง
- In-App Notification สำหรับรอบตรวจล่วงหน้า 7/3/1 วัน มีอ่านแล้ว/ยังไม่อ่านและป้องกันรายการซ้ำ
- ข้อมูลหน้าจอโหลดใหม่ทุก 30 วินาทีขณะเปิดเว็บ และมีปุ่มโหลดใหม่

## ข้อมูลตัวอย่าง

สคริปต์ Seed อ่านตารางตัวอย่างจากภาพ IMG_5287.jpeg ในบทสนทนาที่อ้างถึง ชื่อที่อ่านไม่ชัดจะใช้ [รอยืนยันชื่อ] แพทย์ที่ถอดชื่อได้ยังต้องให้ผู้ดูแลยืนยันการสะกดและชื่อเต็ม โควตา 20 เป็นข้อมูลตัวอย่างเท่านั้น ต้องให้ผู้ดูแลตรวจสอบและแก้ให้ตรงก่อนใช้จริง

## สิ่งที่ต้องเตรียม

- Node.js 20 ขึ้นไป และ pnpm
- บัญชี Google เจ้าของ Spreadsheet/Apps Script
- Google Cloud project ที่เปิดใช้ Google Identity Services และสร้าง OAuth Client ID แบบ Web application
- GitHub repository ที่เปิดใช้ GitHub Pages
- clasp สำหรับ push source Apps Script (ติดตั้งได้ด้วย npm install --global @google/clasp)

## 1. ตั้งค่า Apps Script และสร้าง Google Sheet

1. สร้าง OAuth Client ID แบบ Web application ใน Google Cloud Console
2. เพิ่ม Authorized JavaScript origins อย่างน้อย http://localhost:5173 และ https://YOUR-USER.github.io โดยไม่ใส่ path ของ repository หากใช้ custom domain ให้เพิ่ม origin นั้นด้วย
3. เปิด Apps Script ที่อยู่ในโฟลเดอร์ apps-script ให้เป็น Apps Script project ของบัญชีเจ้าของข้อมูล กำหนด Script ID ในไฟล์ .clasp.json โดยคัดลอกจาก .clasp.json.example
4. ติดตั้ง clasp และเข้าสู่ระบบบัญชี Google เจ้าของสคริปต์ จากโฟลเดอร์โครงการให้ push source:

        npm install --global @google/clasp
        clasp login
        Copy-Item .clasp.json.example .clasp.json
        clasp push

   แก้ .clasp.json ให้ใช้ Script ID จริงก่อนรัน clasp push
5. เปิด Apps Script Editor เลือกฟังก์ชัน setupSpreadsheet แล้วกด Run และอนุญาต scope ที่ Google แสดง สคริปต์จะสร้าง Google Sheet ส่วนตัวพร้อมแท็บ Clinics, Physicians, Users, ScheduleTemplates, Sessions, Notifications และ ActivityEvents จากนั้นบันทึก URL ไว้
6. ใน Apps Script Project Settings → Script properties เพิ่ม GOOGLE_CLIENT_ID เป็นค่า Web Client ID จริง เช่น 123456.apps.googleusercontent.com; SPREADSHEET_ID จะถูกบันทึกโดย setupSpreadsheet()
7. เปิด Google Sheet ที่สร้างขึ้น แล้วเพิ่มแถวแรกในแท็บ Users โดยใช้คอลัมน์:

        id | email | display_name | role | physician_id | is_active | last_active_at | created_at

   ใส่ email ของผู้ดูแล, ชื่อ, role เป็น admin, is_active เป็น TRUE; เว้น id, physician_id, last_active_at และ created_at ได้ ระบบผูก Google subject ID ให้หลังผู้ดูแล login ครั้งแรก
8. กลับ Apps Script เลือก Deploy → New deployment → Web app; ตั้ง Execute as เป็นบัญชีเจ้าของ/ผู้ deploy และกำหนดผู้เข้าถึงเป็น Anyone ตามตัวเลือกที่บัญชีอนุญาต เพื่อให้หน้า GitHub โหลด bridge ได้ ทุกการอ่าน/เขียนข้อมูลยังต้องส่ง Google ID token ที่ผ่านการตรวจและมีบัญชีอยู่ใน Users เท่านั้น
9. คัดลอก URL ที่ลงท้ายด้วย /exec ไว้เป็น VITE_APPS_SCRIPT_URL

ห้ามแชร์ Google Sheet ให้แพทย์หรือบุคคลทั่วไป ให้เฉพาะเจ้าของข้อมูลและผู้ดูแลที่ได้รับมอบหมายเป็น editor ของ Sheet/Apps Script เท่านั้น การเลือก Anyone สำหรับ Web App เปิดเฉพาะหน้าสะพานเชื่อมต่อ; backend ปฏิเสธคำขอที่ไม่มี token หรือไม่มีสิทธิ์ใน Users

## 2. รันเว็บในเครื่อง

1. คัดลอก .env.example เป็น .env.local
2. ใส่ค่า Apps Script URL และ Web Client ID:

        VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
        VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
        VITE_BASE_PATH=/

3. ติดตั้งแพ็กเกจและรันหน้าเว็บ:

        pnpm install
        pnpm dev

4. เปิด http://localhost:5173 แล้วเข้าสู่ระบบด้วย Google account ที่อยู่ใน Users

## 3. Deploy หน้าเว็บบน GitHub Pages

1. สร้าง GitHub repository แล้ว push โครงการนี้ขึ้น branch main
2. ใน Settings → Secrets and variables → Actions เพิ่ม repository secrets:
   - VITE_APPS_SCRIPT_URL: Apps Script Web App URL ที่ลงท้าย /exec
   - VITE_GOOGLE_CLIENT_ID: OAuth Web Client ID
3. ใน Settings → Pages เลือก Build and deployment source เป็น GitHub Actions
4. push เข้า main หรือสั่ง workflow Deploy to GitHub Pages ที่แท็บ Actions
5. เปิด URL รูปแบบ https://YOUR-USER.github.io/YOUR-REPOSITORY/ แล้วตรวจว่าหน้าเข้าสู่ระบบทำงาน

Workflow อยู่ที่ .github/workflows/deploy.yml ส่วน VITE_BASE_PATH ตั้งตามชื่อ repository อัตโนมัติ หากใช้ custom domain อาจต้องแก้ base path ใน workflow เป็น /

การเผยแพร่ Apps Script และหน้าเว็บเป็นคนละขั้นตอน: Apps Script ต้องติดตั้ง/Deploy ด้วยบัญชีเจ้าของ Google Sheet ก่อน แล้ว GitHub Actions จึง build หน้าเว็บโดยใช้ URL และ OAuth Client ID นั้น

## เพิ่มแพทย์และจัดการสิทธิ์

1. ผู้ดูแลเพิ่ม/ยืนยันข้อมูลแพทย์และตารางประจำในหน้าเว็บ
2. กรอก Google email ของแพทย์ ชื่อที่แสดง และเลือกข้อมูลแพทย์ แล้วกดเพิ่มสิทธิ์เข้าเว็บ
3. แจ้ง URL GitHub Pages ให้แพทย์; แพทย์เข้าสู่ระบบด้วย Google account ที่ตรงกับ email ใน Users
4. การเพิ่มสิทธิ์ไม่ได้ส่งอีเมลเชิญอัตโนมัติ และไม่สร้างบัญชี Google ให้แพทย์
5. เพิ่มผู้ดูแลคนอื่นโดยเพิ่มแถว Users ที่ role เป็น admin ผ่านเจ้าของชีต และจำกัดผู้แก้ Spreadsheet ให้น้อยที่สุด

## ตารางประจำและข้อยกเว้น

- weekday ใช้ Sunday=0 ถึง Saturday=6; week_of_month เป็น 0 สำหรับทุกสัปดาห์ หรือ 1–5 สำหรับสัปดาห์ที่กำหนด
- schedule template มีผลกับการสร้างรอบครั้งใหม่ ไม่แก้รอบที่สร้างไว้แล้ว
- รอบที่สร้างแล้วแก้ยอดนัด/โควตา, งดตรวจ หรือกำหนดแพทย์ทดแทนได้ที่เมนูตารางและการติดตาม
- เมื่อแพทย์แจ้งติดภารกิจ ระบบไม่ลบ/ยกเลิกยอดนัดหรือรอบตรวจ ผู้ดูแลต้องบันทึกผลการประสานงาน
- งดตรวจบันทึกเหตุผลในระบบเท่านั้น ไม่ส่งข้อความผู้ป่วยและไม่จัดการนัดรายบุคคล
- ห้ามบันทึกชื่อผู้ป่วย เลขประจำตัว หรือข้อมูลที่ระบุตัวผู้ป่วยในทุกแท็บ

## วิธีทดสอบด้วยมือ

ใช้ Google Sheet และบัญชีทดสอบแยกจากข้อมูลจริง และสร้างผู้ใช้แพทย์ทดสอบอย่างน้อย 2 บัญชี

1. เข้าด้วย Admin ตรวจ 6 คลินิก ตารางตัวอย่าง และ [รอยืนยันชื่อ]; ยืนยันชื่อกับข้อมูลจริงและแก้โควตาตัวอย่างก่อนใช้
2. เพิ่มบัญชี Google ของแพทย์ทดสอบ 2 คนโดยผูกกับแพทย์คนละรายการ แล้วเปิดเว็บใน browser profiles แยกกัน
3. สร้างรอบตรวจล่วงหน้า 90 วันสองครั้ง ตรวจว่าครั้งหลังไม่สร้าง session ซ้ำ
4. แก้ยอดนัด/โควตา ตรวจว่า Dashboard แพทย์เห็นค่าที่แก้พร้อมเวลาปรับปรุง
5. เข้าแพทย์ A แล้วตรวจว่ามองไม่เห็น Session ของแพทย์ B รวมถึงรายการ Notification ของ B; ลองใช้ URL backend โดยตรงโดยไม่มี Google token แล้วต้องถูกปฏิเสธ
6. แพทย์ A กดยืนยัน แล้วตรวจสถานะบน Admin; แพทย์ B แจ้งติดภารกิจพร้อมหมายเหตุ แล้วตรวจว่ารอบยังไม่ถูกยกเลิก
7. Admin บันทึกผลจัดการ เปลี่ยนแพทย์ทดแทน และทดสอบงดตรวจ; ตรวจ ActivityEvents ว่ามีผู้ทำ เวลา และข้อมูลก่อน/หลัง
8. สำหรับการเตือน ให้ปรับวัน Session ทดสอบเป็นวันนี้ +7, +3 หรือ +1 วัน เปิดหน้าเว็บแพทย์ และตรวจ Notifications; โหลดหน้าซ้ำหลายครั้งแล้วต้องไม่มีรายการเตือนซ้ำ
9. เข้าด้วยบัญชีที่ไม่ได้อยู่ Users ต้องถูกปฏิเสธ และออกจากระบบแล้วต้องเข้าถึงข้อมูลไม่ได้
10. Push branch main และดู Actions ว่า build/deploy ผ่าน จากนั้นเปิด URL GitHub Pages บนมือถือ

## ขอบเขตการแจ้งเตือน

การเตือนเป็น In-App เท่านั้น ไม่มี Push, SMS, LINE หรืออีเมลแจ้งเตือน แพทย์ต้องเปิดเว็บเพื่อให้ระบบคำนวณและแสดงรายการเตือน ผู้ดูแลเห็นผู้ที่ยังไม่ยืนยันและ last active ในหน้า Admin ระหว่างที่เปิดเว็บ ระบบโหลดข้อมูลซ้ำเป็นระยะเพื่อให้ข้อมูลที่เปิดอยู่ทันสมัย แต่ไม่สามารถแจ้งผู้ที่ไม่ได้เข้าเว็บได้

## การทดสอบและข้อจำกัดการใช้งาน

สคริปต์ Apps Script ทำงานภายใต้โควตาของ Google และไม่เหมาะกับการเขียนพร้อมกันจำนวนมาก แท็บ Google Sheets ให้ผู้ดูแลที่ได้รับสิทธิ์เห็นข้อมูลทุกแถว จึงต้องดูแลการแชร์และสำรองข้อมูลอย่างเข้มงวด Google ระบุว่า tokeninfo มีไว้ตรวจสอบ/ดีบักและอาจถูกจำกัดคำขอ ระบบนี้เรียกใช้ตอน login เท่านั้น แต่ยังควรเปลี่ยนเป็นการตรวจ JWT ด้วยไลบรารีที่รองรับก่อนใช้งานจริงในวงกว้าง ฟังก์ชันและการแยกสิทธิ์ไม่ได้ทดสอบกับบัญชี Google จริงใน workspace นี้ ผู้ดูแลต้องตั้งค่า OAuth, Apps Script, Spreadsheet และ GitHub ด้วยบัญชีของตนก่อนทดสอบ end-to-end

## เอกสารทางการ

- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script google.script.run](https://developers.google.com/apps-script/guides/html/communication)
- [ตรวจสอบ Google ID token ฝั่ง server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Google ระบุข้อจำกัดของ tokeninfo สำหรับ production](https://developers.google.com/identity/sign-in/web/backend-auth)
- [GitHub Pages custom GitHub Actions workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
