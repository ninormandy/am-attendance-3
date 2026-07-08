// pages/api/attendance/submit.js
// 🛡️ Advanced Digital Forensics Core Patch v2 (Anti-Multi-Row Trap) - By Dr.Hackerman
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import formidable from 'formidable';
import crypto from 'crypto';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disables legacy body parsing to protect high-speed multipart streams
  },
};

// Extraction Helper: Normalizes array mutations caused by mobile serverless headers
function extractValue(field) {
  if (Array.isArray(field)) return field[0];
  return field;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(456).json({ success: false, error: 'Method not allowed' });
  }

  // Verify Supabase Database connection health state
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    return res.status(500).json({ 
      success: false, 
      error: 'Database transaction context layer configuration error.' 
    });
  }

  // 🌐 Forensic Acquisition: Sniff network layer components safely through Vercel proxies
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // 📱 Hardware Profiling: Extract real agent identifiers instead of relying on spoofable frontend strings
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  const form = formidable({
    uploadDir: '/tmp', // Protect serverless boundary layers
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024 // 15MB cushion for high-resolution mobile camera uploads
  });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed parsing file data pipeline stream' });
    }

    // Capture explicit keys exactly matching the relational schema variables
    const week_id = extractValue(fields.week_id); 
    const student_id_raw = extractValue(fields.student_id);
    const answer_raw = extractValue(fields.answer);
    const fingerprint_raw = extractValue(fields.fingerprint);
    const rawPhotoFile = files.photo && Array.isArray(files.photo) ? files.photo[0] : files.photo;

    if (!week_id || !student_id_raw || !rawPhotoFile) {
      if (rawPhotoFile && fs.existsSync(rawPhotoFile.filepath)) fs.unlinkSync(rawPhotoFile.filepath);
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วนหรือไม่พบไฟล์ภาพถ่ายหลักฐาน' });
    }

    const student_id = student_id_raw.trim();
    const tempFilePath = rawPhotoFile.filepath;

    try {
      // A. Enforce week session open state logic gates
      const { data: week } = await supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle();
      if (!week || week.status !== 'open') {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(403).json({ success: false, error: 'การเช็คชื่อในสัปดาห์นี้ถูกปิดระบบแล้ว' });
      }

      // B. Enforce enrollment record authorization validation
      const { data: student } = await supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id).maybeSingle();
      if (!student) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(404).json({ success: false, error: 'ไม่พบรหัสนักศึกษานี้ในระบบฐานข้อมูลหลัก' });
      }

      // 🛡️ Strict Duplication Gate Check
      const { data: existingRecord, error: checkError } = await supabaseAdmin
        .from('attendance_records')
        .select('id')
        .eq('week_id', week_id)
        .eq('student_id', student.student_id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRecord && existingRecord.id) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(409).json({ 
          success: false, 
          code: 'DUPLICATE_ATTENDANCE', 
          error: 'รหัสนักศึกษานี้ได้ทำการเช็คชื่อในสัปดาห์นี้ไปแล้ว' 
        });
      }

      // 🧠 [DIGITAL FORENSICS WORKFLOW] Hash binary file
      const fileBuffer = await fs.promises.readFile(tempFilePath);
      const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 🎯 [CRITICAL REFACTOR BY DR.HACKERMAN] เปลี่ยนโครงสร้างมาใช้ .limit(1) เพื่อทลายบั๊ก Multi-row Exception
      
      // 1. ตรวจสอบรูปภาพซ้ำ (คัดเลือกมาแค่ 1 แถวล่าสุดที่มีประวัติชนกัน)
      const { data: dupImageRows } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('image_hash', imageHash)
        .limit(1);
      const duplicateImage = dupImageRows && dupImageRows.length > 0 ? dupImageRows[0] : null;

      // 2. ตรวจสอบ Hardware Fingerprint ซ้ำ (คัดเลือกมาแค่ 1 แถวล่าสุดที่มีประวัติชนกัน)
      let duplicateFingerprint = null;
      if (fingerprint_raw) {
        const { data: dupFingerprintRows } = await supabaseAdmin
          .from('attendance_records')
          .select('student_id')
          .eq('week_id', week_id)
          .eq('device_fingerprint', fingerprint_raw)
          .limit(1);
        duplicateFingerprint = dupFingerprintRows && dupFingerprintRows.length > 0 ? dupFingerprintRows[0] : null;
      }

      // 3. ตรวจสอบพิกัด IP เน็ตเวิร์กชนกัน (คัดเลือกมาแค่ 1 แถวล่าสุดที่มีประวัติชนกัน)
      const { data: dupIPRows } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('ip_address', ipAddress)
        .limit(1);
      const duplicateIP = dupIPRows && dupIPRows.length > 0 ? dupIPRows[0] : null;

      // Core Intelligence Evaluation Matrix (Determines Admin Dashboard Signals)
      let adminVerificationStatus = 'pending';
      let adminVerificationNotes = 'CLEAN: อัตลักษณ์ดิจิทัลปกติ';

      if (duplicateImage && duplicateImage.student_id !== student.student_id) {
        adminVerificationStatus = 'flagged';
        adminVerificationNotes = `🚨 FLAGGED: ไฟล์รูปภาพซ้ำกับรหัสนักศึกษา ${duplicateImage.student_id}`;
      } else if (duplicateFingerprint && duplicateFingerprint.student_id !== student.student_id) {
        adminVerificationStatus = 'suspicious';
        adminVerificationNotes = `⚠️ SUSPICIOUS: ฮาร์ดแวร์ Token ซ้ำกับรหัสนักศึกษา ${duplicateFingerprint.student_id}`;
      } else if (duplicateIP && duplicateIP.student_id !== student.student_id) {
        adminVerificationNotes = `ℹ️ Shared Network IP detected with student ${duplicateIP.student_id}`;
      }

      // C. Stream file payload safely to your Supabase Storage Bucket
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

      // D. Generate secure link mapping properties
      const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

      // E. Database Insert - Writing directly into the specific database schema coordinates
      const { data: record, error: insErr } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          week_id,
          student_id: student.student_id,
          student_name: student.name,
          answer: answer_raw ? String(answer_raw).trim() : null,
          photo_url: publicUrl,
          device_fingerprint: fingerprint_raw || 'Bypassed Client',
          verification_status: adminVerificationStatus,
          device_info: userAgent,
          image_hash: imageHash,
          ip_address: ipAddress,
          verification_notes: adminVerificationNotes
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === '23505') {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          return res.status(409).json({ success: false, code: 'DUPLICATE_ATTENDANCE', error: 'รหัสนักศึกษานี้ได้บันทึกเวลาไปแล้ว' });
        }
        throw insErr;
      }

      // Clean storage blocks immediately (Garbage Collection optimization)
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

      return res.status(201).json({ success: true, record });

    } catch (error) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.error('Core Backend Forensic Engine Exception:', error);
      return res.status(500).json({ success: false, error: error.message || 'ระบบประมวลผลข้อมูลหลังบ้านขัดข้อง' });
    }
  });
}