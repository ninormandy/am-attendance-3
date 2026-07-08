// pages/api/attendance/submit.js
// 🛡️ Bulletproof Module Resolution & Serverless Patch by Dr.Hackerman
const crypto = require('crypto');
const formidable = require('formidable');
const fs = require('fs');

// 🎯 ANTI-UNDEFINED SAFEGUARD: การันตีการดึงโมดูลเชื่อมฐานข้อมูลในสภาพแวดล้อม Serverless คลาวด์
let supabaseAdmin = null;
try {
  const supabaseModule = require('../../../lib/supabaseAdmin');
  supabaseAdmin = supabaseModule.supabaseAdmin || supabaseModule.default || supabaseModule;
} catch (pathError) {
  console.error("🚨 Path Error: ไม่พบไฟล์ supabaseAdmin กรุณาตรวจสอบตำแหน่งโฟลเดอร์ ../../../lib/");
}

// ยุติระบบ Middleware พื้นฐาน เพื่อให้ Formidable ควบคุม Multipart Stream เต็มประสิทธิภาพ
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper Function: คัดกรองค่ากรณีฟิลด์ข้อความถูกแปรสภาพเป็น Array บนคลาวด์บราวเซอร์มือถือ
function extractValue(field) {
  if (Array.isArray(field)) return field[0];
  return field;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(456).json({ success: false, error: 'Method not allowed' });
  }

  // ตรวจสอบอินสแตนซ์ Supabase ก่อนเริ่มประมวลผลธุรกรรมข้อมูล
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    return res.status(500).json({ 
      success: false, 
      error: 'ระบบหลังบ้านไม่สามารถดึงข้อมูล Configuration ของฐานข้อมูลได้ กรุณาตรวจสอบไฟล์ lib/supabaseAdmin.js' 
    });
  }

  // 🌐 Forensic Logs: สกัดพิกัดไอพีเครือข่ายอินเทอร์เน็ต (Vercel Proxy Edge Compliant)
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // 📱 Forensic Logs: สกัดข้อมูลสเปกบราวเซอร์ฮาร์ดแวร์จริง (User-Agent)
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  // ตั้งค่าจุดบันทึกไฟล์ชั่วคราวให้อยู่ในขอบเขต /tmp ตามข้อบังคับของพื้นที่ Cloud Vercel
  const form = formidable({
    uploadDir: '/tmp',
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024 // ล็อกความละเอียดภาพถ่ายสูงสุดไม่เกิน 15MB ป้องกัน Timeout
  });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed parsing file data pipeline stream' });
    }

    // ดึงข้อมูลออกจากฟิลด์อย่างปลอดภัยและเสถียร
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
      // A. ตรวจสอบสถานะคาบเรียนเปิดปิดระบบ (Week Session Gating)
      const { data: week } = await supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle();
      if (!week || week.status !== 'open') {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(403).json({ success: false, error: 'การเช็คชื่อถูกปิดแล้ว' });
      }

      // B. ตรวจสอบสิทธิ์รายชื่อวิชาเรียน (Enrollment Check)
      const { data: student } = await supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id).maybeSingle();
      if (!student) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(404).json({ success: false, error: 'ไม่พบรหัสนักศึกษาคนนี้ในระบบวิชาเรียน' });
      }

      // 🛡️ ตรวจสอบการส่งซ้ำระดับฐานข้อมูลชั้นที่ 1 (Student ID Unique Gate Check)
      const { data: existingRecord } = await supabaseAdmin
        .from('attendance_records')
        .select('id')
        .eq('week_id', week_id)
        .eq('student_id', student.student_id)
        .maybeSingle();

      if (existingRecord) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(409).json({ 
          success: false, 
          code: 'DUPLICATE_ATTENDANCE', // 🎯 ส่ง Code พิเศษเพื่อให้ระบบหน้าบ้านแยกแยะประเภท Error ได้ถูกต้องแม่นยำ ไม่สับสน
          error: 'รหัสนักศึกษานี้ได้ทำการเช็คชื่อในสัปดาห์นี้ไปแล้ว' 
        });
      }

      // 🧠 [DIGITAL FORENSICS 1] ถอดรหัสแฮชไฟล์ภาพ (Cryptographic Image Hashing)
      const fileBuffer = fs.readFileSync(tempFilePath);
      const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // ตรวจสอบพฤติกรรมรูปถ่ายซ้ำในคาบเรียนเดียวกัน
      const { data: duplicateImage } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('image_hash', imageHash)
        .maybeSingle();

      // 🧠 [DIGITAL FORENSICS 2] ตรวจสอบพฤติกรรมพิกัดไอพีเครือข่ายซ้ำ
      const { data: duplicateIP } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('ip_address', ipAddress)
        .maybeSingle();

      // กำหนดสถานะรายงานสำหรับแสดงผลบน Dashboard หน้าแอดมินหลังบ้าน
      let adminVerificationStatus = 'pending';
      let adminVerificationNotes = 'CLEAN: อัตลักษณ์ดิจิทัลปกติ';

      if (duplicateImage) {
        adminVerificationStatus = 'flagged';
        adminVerificationNotes = `🚨 FLAGGED: ไฟล์รูปภาพซ้ำกับรหัสนักศึกษา ${duplicateImage.student_id}`;
      } else if (duplicateIP) {
        adminVerificationStatus = 'suspicious';
        adminVerificationNotes = `⚠️ SUSPICIOUS: พิกัดไอพีเครือข่ายซ้ำกับรหัสนักศึกษา ${duplicateIP.student_id}`;
      }

      // C. อัปโหลดกระแสข้อมูลไบนารีภาพหลักฐานขึ้นคลาวด์จัดเก็บไฟล์ (Supabase Storage Buckets)
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

      // D. เรียกตำแหน่งลิงก์ URL สาธารณะของไฟล์ภาพหลักฐานเข้าสู่ระบบ
      const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

      // E. ลงบันทึกประวัติรอยเท้าดิจิทัลและข้อมูลเช็คชื่อเข้าตารางหลักของแอดมิน
      const { data: record, error: insErr } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          week_id,
          student_id: student.student_id,
          student_name: student.name,
          answer: answer_raw ? String(answer_raw).trim() : null,
          device_fingerprint: fingerprint_raw || 'No Fingerprint Attached',
          photo_url: publicUrl,
          image_hash: imageHash,
          ip_address: ipAddress,
          device_info: userAgent,
          verification_status: adminVerificationStatus,
          verification_notes: adminVerificationNotes
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === '23505') {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          return res.status(409).json({ success: false, code: 'DUPLICATE_ATTENDANCE', error: 'รหัสนักศึกษานี้หรืออุปกรณ์นี้ได้บันทึกเวลาไปแล้ว' });
        }
        throw insErr;
      }

      // ล้างไฟล์ขยะชั่วคราวออกจากดิสก์ Serverless ทุกครั้งหลังส่งสำเร็จ (Garbage Collection)
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

      return res.status(201).json({ success: true, record });

    } catch (error) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.error('Core Backend Engine Fault:', error);
      return res.status(500).json({ success: false, error: error.message || 'ระบบประมวลผลข้อมูลหลังบ้านขัดข้อง' });
    }
  });
}