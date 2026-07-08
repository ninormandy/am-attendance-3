// pages/api/attendance/submit.js
// 🛡️ Optimized and Module-Safe Production Patch by Dr.Hackerman
const supabaseModule = require('../../../lib/supabaseAdmin');
const formidable = require('formidable');
const crypto = require('crypto');
const fs = require('fs');

// 🎯 ANTI-UNDEFINED RESOLUTION: Safely extract the database instance regardless of bundler state
const supabaseAdmin = supabaseModule.supabaseAdmin || supabaseModule.default || supabaseModule;

// Stop Next.js framework core from interfering with multipart/form-data streams
export const config = {
  api: {
    bodyParser: false,
  },
};

// Robust Extraction Helper: Safely reads fields regardless of string or array variance
function extractValue(field) {
  if (Array.isArray(field)) return field[0];
  return field;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(456).json({ success: false, error: 'Method not allowed' });
  }

  // Double check connection layer health before initiating data pipeline stream
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    return res.status(500).json({ success: false, error: 'Database context layer configuration error.' });
  }

  // 🌐 Forensic Acquisition: Capture digital footprint details for the Admin Audit Log
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  // 🛡️ Configure Formidable specifically to comply with cloud serverless disk boundaries
  const form = formidable({
    uploadDir: '/tmp', // Forces temporary writes into safe serverless memory allocations
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024 // 15MB ceiling to comfortably accommodate modern smartphone cameras
  });
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed parsing file data pipeline stream' });
    }

    // Clean value extraction
    const week_id_raw = extractValue(fields.week_id);
    const student_id_raw = extractValue(fields.student_id);
    const answer_raw = extractValue(fields.answer);
    const fingerprint_raw = extractValue(fields.fingerprint);
    const rawPhotoFile = files.photo && Array.isArray(files.photo) ? files.photo[0] : files.photo;

    if (!week_id_raw || !student_id_raw || !rawPhotoFile) {
      if (rawPhotoFile && fs.existsSync(rawPhotoFile.filepath)) fs.unlinkSync(rawPhotoFile.filepath);
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วนหรือไม่พบรหัสกล้องภาพถ่าย' });
    }

    const week_id = week_id_raw;
    const student_id = student_id_raw.trim();
    const tempFilePath = rawPhotoFile.filepath;

    try {
      // A. Enforce week session open state logic gates
      const { data: week } = await supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle();
      if (!week || week.status !== 'open') {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(403).json({ success: false, error: 'การเช็คชื่อถูกปิดแล้ว' });
      }

      // B. Enforce enrollment checks
      const { data: student } = await supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id).maybeSingle();
      if (!student) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(404).json({ success: false, error: 'ไม่พบรหัสนักเรียนนี้ในระบบฐานข้อมูล' });
      }

      // 🛡️ HARD DATABASE DUPLICATION GATE: Check student ID before writing large files
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

      // 🧠 [DIGITAL FORENSICS] Compute file integrity hash to surface potential device sharing
      const fileBuffer = fs.readFileSync(tempFilePath);
      const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check for matching hashes or network patterns to calculate administrative logs
      const { data: duplicateImage } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('image_hash', imageHash)
        .maybeSingle();

      const { data: duplicateIP } = await supabaseAdmin
        .from('attendance_records')
        .select('student_id')
        .eq('week_id', week_id)
        .eq('ip_address', ipAddress)
        .maybeSingle();

      // Compile internal analysis verification parameters for the admin dashboard view
      let adminVerificationStatus = 'pending';
      let adminVerificationNotes = 'CLEAN: อัตลักษณ์ดิจิทัลปกติ';

      if (duplicateImage) {
        adminVerificationStatus = 'flagged';
        adminVerificationNotes = `🚨 FLAGGED: ไฟล์รูปภาพซ้ำกับรหัสนักศึกษา ${duplicateImage.student_id}`;
      } else if (duplicateIP) {
        adminVerificationStatus = 'suspicious';
        adminVerificationNotes = `⚠️ SUSPICIOUS: พิกัดไอพีเครือข่ายซ้ำกับรหัสนักศึกษา ${duplicateIP.student_id}`;
      }

      // C. Stream file binary to Supabase Cloud Buckets
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

      // D. Extract file storage public url parameter location keys
      const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

      // E. Save transaction record to relational database tables with forensics attached
      const { data: record, error: insErr } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          week_id,
          student_id: student.student_id,
          student_name: student.name,
          answer: answer_raw ? String(answer_raw).trim() : null,
          device_fingerprint: fingerprint_raw || 'No Fingerprint Attached',
          photo_url: publicUrl, 
          image_hash: imageHash,                        // 🗄️ Unique asset fingerprint
          ip_address: ipAddress,                        // 🌐 Client IP tracking
          device_info: userAgent,                       // 📱 User-Agent device data
          verification_status: adminVerificationStatus, // Admin validation helper status
          verification_notes: adminVerificationNotes    // Visible alert strings inside your table
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

      // Clear disk workspace memory segments (Garbage Collection)
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

      return res.status(201).json({ success: true, ok: true, record });

    } catch (error) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.error('Core Backend Stack Fault:', error);
      return res.status(500).json({ success: false, error: error.message || 'ระบบหลังบ้านเกิดความขัดข้อง' });
    }
  });
}