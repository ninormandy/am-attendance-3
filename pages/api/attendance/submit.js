// pages/api/attendance/submit.js
// 🛡️ Bulletproof Module Resolution & Serverless Patch by Dr.Hackerman
const crypto = require('crypto');
const formidable = require('formidable');
const fs = require('fs');

// 🎯 ปรับปรุงจุดวิกฤต: เพิ่มระบบค้นหาพิกัดและสกัดค่าอินสแตนซ์ฐานข้อมูลขั้นสูง (Advanced Module Resolver)
let supabaseAdmin = null;
try {
  const supabaseModule = require('../../../lib/supabaseAdmin');
  // ตรวจสอบคีย์ทุกช่องทาง (export const, export default, module.exports)
  supabaseAdmin = supabaseModule.supabaseAdmin || supabaseModule.default || supabaseModule;
} catch (pathError) {
  console.error("🚨 Path Error: ไม่พบไฟล์ supabaseAdmin กรุณาตรวจสอบตำแหน่งโฟลเดอร์ ../../../lib/");
}

// ยุติระบบ Middleware ของเฟรมเวิร์คชั่วคราว เพื่อปล่อยให้ Formidable ควบคุมข้อมูลภาพมัลติพาร์ท
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper Function: คัดกรองค่ากรณีฟิลด์ข้อความถูกแปรสภาพเป็น Array บนระบบ Serverless Cloud
function extractValue(field) {
  if (Array.isArray(field)) return field[0];
  return field;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(456).json({ success: false, error: 'Method not allowed' });
  }

  // 🎯 ด่านเคลียร์บั๊ก: ตรวจสอบสถานะหากยังไม่พร้อมใช้งาน จะสลับมาโหลดแบบ Direct Object ทันที
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    console.error('🚨 Database context layer configuration error. Retrying fallback resolution...');
    // กลไกสำรองกู้คืนระบบกรณีโครงสร้าง Config ซับซ้อน
    try {
      const fallbackModule = require('../../../lib/supabaseAdmin');
      if (fallbackModule && typeof fallbackModule === 'function') supabaseAdmin = fallbackModule;
    } catch (e) {}
    
    // หากพยายามกู้คืนแล้วยังไม่ผ่าน ให้ส่งข้อความแจ้งเตือนอย่างชัดเจนเพื่อไม่ให้ระบบค้าง
    if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
      return res.status(500).json({ 
        success: false, 
        error: 'ระบบหลังบ้านไม่สามารถดึงข้อมูล Configuration ของฐานข้อมูลได้ กรุณาตรวจสอบไฟล์ lib/supabaseAdmin.js' 
      });
    }
  }

  // 🌐 Forensic Logs: ดึงข้อมูลพิกัดเครือข่าย IP Address (รองรับ Vercel Proxy Gateway)
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // 📱 Forensic Logs: ดึงข้อมูลชนิดและสเปกเครื่องของบราวเซอร์นักศึกษา (User-Agent)
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  // ตั้งค่าสภาพแวดล้อมพื้นที่เก็บไฟล์รูปถ่ายชั่วคราวให้ปลอดภัยบนระเบียบคลาวด์ Serverless
  const form = formidable({
    uploadDir: '/tmp', // เขียนไฟล์ลงไดเรกทอรีชั่วคราวตามกฎ Vercel 
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024 // จำกัดขนาดรูปภาพสูงสุด 15MB ป้องกัน Timeout
  });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed parsing file data pipeline stream' });
    }

    // สกัดข้อมูลออกจากฟิลด์อย่างปลอดภัย
    const week_id_raw = extractValue(fields.week_id);
    const student_id_raw = extractValue(fields.student_id);
    const answer_raw = extractValue(fields.answer);
    const fingerprint_raw = extractValue(fields.fingerprint);
    const rawPhotoFile = files.photo && Array.isArray(files.photo) ? files.photo[0] : files.photo;

    if (!week_id_raw || !student_id_raw || !rawPhotoFile) {
      if (rawPhotoFile && fs.existsSync(rawPhotoFile.filepath)) fs.unlinkSync(rawPhotoFile.filepath);
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วนหรือไม่พบไฟล์ภาพถ่ายหลักฐาน' });
    }

    const week_id = week_id_raw;
    const student_id = student_id_raw.trim();
    const tempFilePath = rawPhotoFile.filepath;

    try {
      // A. ตรวจสอบสถานะการเปิดคาบเรียน (Week Session Gating)
      const { data: week } = await supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle();
      if (!week || week.status !== 'open') {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(403).json({ success: false, error: 'การเช็คชื่อถูกปิดแล้ว' });
      }

      // B. ตรวจสอบสิทธิ์ทะเบียนรายชื่อนักศึกษา (Enrollment Check)
      const { data: student } = await supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id).maybeSingle();
      if (!student) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(404).json({ success: false, error: 'ไม่พบรหัสนักศึกษาคนนี้ในระบบวิชาเรียน' });
      }

      // 🛡️ ตรวจสอบการส่งข้อสอบซ้ำผ่านตารางหลัก (Student ID Duplication Gate)
      const { data: existingRecord } = await supabaseAdmin
        .from('attendance_records')
        .select('id')
        .eq('week_id', week_id)
        .eq('student_id', student.student_id)
        .maybeSingle();

      if (existingRecord) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(409).json({ success: false, error: 'รหัสนักศึกษานี้ได้ทำการเช็คชื่อในสัปดาห์นี้ไปแล้ว' });
      }

      // 🧠 [DIGITAL FORENSICS 1] ถอดรหัสลับของไฟล์ภาพถ่ายจริง (Cryptographic Hashing)
      const fileBuffer = fs.readFileSync(tempFilePath);
      const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // ค้นหาพิรุธความซ้ำซ้อนของรูปถ่ายหลักฐานในเซสชันเดียวกัน
      const { data: duplicateImage } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('image_hash', imageHash)
        .maybeSingle();

      // 🧠 [DIGITAL FORENSICS 2] ค้นหาพิรุธความซ้ำซ้อนของไอพีเครือข่ายอินเทอร์เน็ต
      const { data: duplicateIP } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('ip_address', ipAddress)
        .maybeSingle();

      // ประมวลผลลัพธ์เพื่อติดแท็กรายงานแอดมินหลังบ้าน (Admin Audit Logs Indicator)
      let adminVerificationStatus = 'pending';
      let adminVerificationNotes = 'CLEAN: อัตลักษณ์ดิจิทัลปกติ';

      if (duplicateImage) {
        adminVerificationStatus = 'flagged';
        adminVerificationNotes = `🚨 FLAGGED: ไฟล์รูปภาพซ้ำกับรหัสนักศึกษา ${duplicateImage.student_id}`;
      } else if (duplicateIP) {
        adminVerificationStatus = 'suspicious';
        adminVerificationNotes = `⚠️ SUSPICIOUS: พิกัดไอพีเครือข่ายซ้ำกับรหัสนักศึกษา ${duplicateIP.student_id}`;
      }

      // C. สตรีมไฟล์ไบนารีขึ้นคลาวด์จัดเก็บข้อมูล (Supabase Storage Buckets)
      const originalName = rawPhotoFile.originalFilename || 'photo.jpg';
      const fileExtension = originalName.split('.').pop() || 'jpg';
      const storagePath = `${week_id}/${student.student_id}_${Date.now()}.${fileExtension}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('attendance-proofs')
        .upload(storagePath, fileBuffer, {
          contentType: rawPhotoFile.mimetype || 'image/jpeg',
          upsert: true
        });

      if (uploadErr) throw new Error(`Storage upload crash: ${uploadErr.message}`);

      // D. ดึงลิงก์ตำแหน่ง URL สาธารณะของรูปถ่ายหลักฐานเข้าสู่ตารางระบบ
      const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

      // E. บันทึกประวัติและข้อมูลรอยเท้าดิจิทัลลงฐานข้อมูลหลัก
      const { data: record, error: insErr } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          week_id,
          student_id: student.student_id,
          student_name: student.name,
          answer: answer_raw ? String(answer_raw).trim() : null,
          device_fingerprint: fingerprint_raw || 'No Fingerprint Attached',
          photo_url: publicUrl,
          image_hash: imageHash,                        // บันทึกแฮชไฟล์ภาพคัดกรองตรวจซ้ำ
          ip_address: ipAddress,                        // บันทึกไอพีเน็ตเวิร์ก
          device_info: userAgent,                       // บันทึกชนิดข้อมูลอุปกรณ์ นศ.
          verification_status: adminVerificationStatus, // บันทึกสถานะรายงานแอดมิน (pending | flagged | suspicious)
          verification_notes: adminVerificationNotes    // ข้อความอธิบายความผิดปกติยันตารางหน้า Dashboard แอดมิน
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === '23505') {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          return res.status(409).json({ success: false, error: 'รหัสนักศึกษานี้หรืออุปกรณ์นี้ได้บันทึกเวลาไปแล้ว' });
        }
        throw insErr;
      }

      // ล้างไฟล์ขยะเคลียร์พื้นที่ไดเรกทอรีชั่วคราวคลาวด์หลังส่งเสร็จสิ้น (Garbage Collection)
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

      return res.status(201).json({ success: true, ok: true, record });

    } catch (error) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.error('Core Backend Engine Fault:', error);
      return res.status(500).json({ success: false, error: error.message || 'ระบบประมวลผลข้อมูลหลังบ้านขัดข้อง' });
    }
  });
}