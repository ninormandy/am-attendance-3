// pages/api/attendance/submit.js
// 🛡️ High-Throughput Digital Forensics Core - Optimized by Dr.Hackerman
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import formidable from 'formidable';
import crypto from 'crypto';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Required for Formidable multipart stream handling
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

  // 🌐 Forensic Acquisition: Sniff network layer components safely through proxies
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  // 📱 Hardware Profiling: Extract real user-agent string
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  const form = formidable({
    uploadDir: '/tmp', // Protect serverless boundary layers
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024 // 15MB cushion for high-resolution uploads
  });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed parsing file data pipeline stream' });
    }

    const week_id = extractValue(fields.week_id); 
    const student_id_raw = extractValue(fields.student_id);
    const answer_raw = extractValue(fields.answer);
    const fingerprint_raw = extractValue(fields.fingerprint);
    const rawPhotoFile = files.photo && Array.isArray(files.photo) ? files.photo[0] : files.photo;

    if (!week_id || !student_id_raw || !rawPhotoFile) {
      if (rawPhotoFile && fs.existsSync(rawPhotoFile.filepath)) {
        await fs.promises.unlink(rawPhotoFile.filepath).catch(() => {});
      }
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วนหรือไม่พบไฟล์ภาพถ่ายหลักฐาน' });
    }

    const student_id = student_id_raw.trim();
    const tempFilePath = rawPhotoFile.filepath;

    try {
      // 🚀 PARALLEL EXECUTION BATCH 1: Validate session & enrollment simultaneously
      const [weekResult, studentResult] = await Promise.all([
        supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle(),
        supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id).maybeSingle()
      ]);

      const week = weekResult.data;
      const student = studentResult.data;

      if (!week || week.status !== 'open') {
        await fs.promises.unlink(tempFilePath).catch(() => {});
        return res.status(403).json({ success: false, error: 'การเช็คชื่อในสัปดาห์นี้ถูกปิดระบบแล้ว' });
      }

      if (!student) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
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
        await fs.promises.unlink(tempFilePath).catch(() => {});
        return res.status(409).json({ 
          success: false, 
          code: 'DUPLICATE_ATTENDANCE', 
          error: 'รหัสนักศึกษานี้ได้ทำการเช็คชื่อในสัปดาห์นี้ไปแล้ว' 
        });
      }

      // 🧠 [DIGITAL FORENSICS WORKFLOW] Hash binary file
      const fileBuffer = await fs.promises.readFile(tempFilePath);
      const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 🚀 PARALLEL EXECUTION BATCH 2: Interrogate database for visual, hardware, and IP collisions
      const cleanFingerprint = fingerprint_raw && fingerprint_raw !== 'Bypassed Client' ? fingerprint_raw : null;

      const [dupImgResult, dupFpResult, dupIPResult] = await Promise.all([
        supabaseAdmin.from('attendance_records').select('student_id').eq('week_id', week_id).eq('image_hash', imageHash).limit(1),
        cleanFingerprint 
          ? supabaseAdmin.from('attendance_records').select('student_id').eq('week_id', week_id).eq('device_fingerprint', cleanFingerprint).limit(1)
          : Promise.resolve({ data: null }),
        supabaseAdmin.from('attendance_records').select('student_id').eq('week_id', week_id).eq('ip_address', ipAddress).limit(1)
      ]);

      const duplicateImage = dupImgResult.data && dupImgResult.data.length > 0 ? dupImgResult.data[0] : null;
      const duplicateFingerprint = dupFpResult.data && dupFpResult.data.length > 0 ? dupFpResult.data[0] : null;
      const duplicateIP = dupIPResult.data && dupIPResult.data.length > 0 ? dupIPResult.data[0] : null;

      // Core Intelligence Evaluation Matrix
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

      // C. Stream file payload safely to Supabase Storage Bucket
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

      // D. Generate public link mapping
      const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

      // E. Database Insert
      const { data: record, error: insErr } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          week_id,
          student_id: student.student_id,
          student_name: student.name,
          answer: answer_raw ? String(answer_raw).trim() : null,
          photo_url: publicUrl,
          device_fingerprint: cleanFingerprint || 'Bypassed Client',
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
          await fs.promises.unlink(tempFilePath).catch(() => {});
          return res.status(409).json({ success: false, code: 'DUPLICATE_ATTENDANCE', error: 'รหัสนักศึกษานี้ได้บันทึกเวลาไปแล้ว' });
        }
        throw insErr;
      }

      // Non-blocking cleanup of temporary files
      fs.promises.unlink(tempFilePath).catch(() => {});

      return res.status(201).json({ success: true, record });

    } catch (error) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
      console.error('Core Backend Forensic Engine Exception:', error);
      return res.status(500).json({ success: false, error: error.message || 'ระบบประมวลผลข้อมูลหลังบ้านขัดข้อง' });
    }
  });
}