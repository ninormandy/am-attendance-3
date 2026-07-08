// pages/api/attendance/submit.js
// 🛡️ Production-Grade ES Modules Architecture & Forensic Engine by Dr.Hackerman
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import formidable from 'formidable';
import crypto from 'crypto';
import fs from 'fs';

// ยุติระบบ Middleware พื้นฐาน เพื่อให้ Formidable ควบคุมข้อมูลภาพมัลติพาร์ทได้เต็มประสิทธิภาพ
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper Utility: คัดกรองและสกัดค่าสำหรับฟิลด์ข้อความเพื่อป้องกันสภาวะ Array Type Mismatch
function extractValue(field) {
  if (Array.isArray(field)) return field[0];
  return field;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(456).json({ success: false, error: 'Method not allowed' });
  }

  // 🛡️ Database Context Safe-Guard: ตรวจสอบความพร้อมของ instance ก่อนเริ่ม Data Pipeline
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    return res.status(500).json({ 
      success: false, 
      error: 'ระบบหลังบ้านไม่สามารถเข้าถึงฐานข้อมูลได้ กรุณาตรวจสอบการ Export ในไฟล์ lib/supabaseAdmin.js' 
    });
  }

  // 🌐 Forensic Acquistion: ดักจับพิกัดไอพีเครือข่ายเน็ตเวิร์ก (รองรับสถาปัตยกรรม Vercel Proxy Gateway)
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // 📱 Forensic Acquisition: ดักจับข้อมูลอัตลักษณ์ฮาร์ดแวร์และเวอร์ชันบราวเซอร์ (User-Agent)
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  // ตั้งค่าสภาพแวดล้อมให้ปลอดภัยต่อข้อจำกัด Read-only Filesystem ของระบบ Serverless
  const form = formidable({
    uploadDir: '/tmp', // บังคับเขียนไฟล์ลงพื้นที่หน่วยความจำชั่วคราวเท่านั้น
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024 // ล็อกขนาดรูปถ่ายไม่เกิน 15MB ป้องกันระบบหน่วงช้า
  });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed parsing file data pipeline stream' });
    }

    // สกัดข้อมูลออกจาก Formidable Fields อย่างรัดกุม
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
      // ด่านที่ 1: ตรวจสอบสถานะการเปิดคาบเรียน (Week Session Gating)
      const { data: week } = await supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle();
      if (!week || week.status !== 'open') {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(403).json({ success: false, error: 'การเช็คชื่อถูกปิดแล้ว' });
      }

      // ด่านที่ 2: ตรวจสอบรายชื่อผู้มีสิทธิ์เรียน (Enrollment Check)
      const { data: student } = await supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id).maybeSingle();
      if (!student) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(404).json({ success: false, error: 'ไม่พบรหัสนักศึกษานี้ในระบบฐานข้อมูล' });
      }

      // ด่านที่ 3: ดักจับการส่งข้อมูลซ้ำผ่านตารางหลัก (Student ID Duplication Gate Check)
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
          code: 'DUPLICATE_ATTENDANCE', 
          error: 'รหัสนักศึกษานี้ได้ทำการเช็คชื่อในสัปดาห์นี้ไปแล้ว' 
        });
      }

      // 🧠 [DIGITAL FORENSICS 1] ถอดรหัสลับของไฟล์ภาพถ่ายจริงด้วยระบบสัญญา Non-blocking Promises
      const fileBuffer = await fs.promises.readFile(tempFilePath);
      const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // ตรวจสอบพฤติกรรมรูปถ่ายซ้ำเวียนเทียนส่งในคาบเรียนเดียวกัน
      const { data: duplicateImage } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('image_hash', imageHash)
        .maybeSingle();

      // ตรวจสอบพฤติกรรมความซ้ำซ้อนของไอพีเพื่อตรวจจับกรณีใช้เครื่องเดียวสลับแท็บส่งแทนเพื่อน
      const { data: duplicateIP } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('ip_address', ipAddress)
        .maybeSingle();

      // วิเคราะห์สถิติดิจิทัลเพื่อผูกแท็กแจ้งเตือนไปยังหน้าจอควบคุมของแอดมิน (Admin Flags Matrix)
      let adminVerificationStatus = 'pending';
      let adminVerificationNotes = 'CLEAN: อัตลักษณ์ดิจิทัลปกติ';

      if (duplicateImage) {
        adminVerificationStatus = 'flagged';
        adminVerificationNotes = `🚨 FLAGGED: ไฟล์รูปภาพซ้ำกับรหัสนักศึกษา ${duplicateImage.student_id}`;
      } else if (duplicateIP) {
        adminVerificationStatus = 'suspicious';
        adminVerificationNotes = `⚠️ SUSPICIOUS: พิกัดไอพีเครือข่ายซ้ำกับรหัสนักศึกษา ${duplicateIP.student_id}`;
      }

      // --- กระบวนการสตรีมไฟล์ขึ้นคลาวด์จัดเก็บข้อมูล (Supabase Storage Buckets) ---
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

      // ดึงลิงก์ตำแหน่ง URL สาธารณะของไฟล์รูปหลักฐานเพื่อนำไปบันทึกลงฐานข้อมูลข้อมูล
      const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

      // --- ลงบันทึกประวัติรอยเท้าดิจิทัลและธุรกรรมควิซเช็คชื่อเข้าตารางหลัก ---
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

      // เคลียร์พื้นที่ไฟล์ขยะออกจากหน่วยความจำดิสก์ชั่วคราวของเซิร์ฟเวอร์ (Garbage Collection)
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

      return res.status(201).json({ success: true, record });

    } catch (error) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.error('Core Backend Engine Fault:', error);
      return res.status(500).json({ success: false, error: error.message || 'ระบบประมวลผลข้อมูลหลังบ้านขัดข้อง' });
    }
  });
}