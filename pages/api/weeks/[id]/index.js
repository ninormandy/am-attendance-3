// 🛡️ Bulletproof API Forensics Router - Fixed Missing Column Selection by Dr.Hackerman
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  // 1. ตรวจสอบและดึงข้อมูลสัปดาห์เรียน
  const { data: week, error: weekErr } = await supabaseAdmin
    .from('weeks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
    
  if (weekErr) return res.status(500).json({ error: weekErr.message });
  if (!week) return res.status(404).json({ error: 'ไม่พบสัปดาห์นี้' });

  // 2. 🎯 [CRITICAL REFACTOR] เพิ่มคอลัมน์ 'verification_notes' เข้าไปใน query string อย่างเด็ดขาด
  const { data: records, error: recErr } = await supabaseAdmin
    .from('attendance_records')
    .select('id, student_id, student_name, answer, seconds_taken, submitted_at, photo_url, verification_status, verification_notes')
    .eq('week_id', id)
    .order('submitted_at', { ascending: true });
    
  if (recErr) return res.status(500).json({ error: recErr.message });

  // 3. ดึงจำนวนนักเรียนทั้งหมดในระบบเพื่อคำนวณอัตราสถิติมา/ขาด
  const { count: totalStudents, error: countErr } = await supabaseAdmin
    .from('students')
    .select('*', { count: 'exact', head: true });
    
  if (countErr) return res.status(500).json({ error: countErr.message });

  // 4. Standardize naming conventions เพื่อป้องกันหน้าบ้านสับสนโครงสร้าง Case
  const standardizedRecords = records.map(row => ({
    ...row,
    photoUrl: row.photo_url,
    verificationStatus: row.verification_status,
    verificationNotes: row.verification_notes // 🎯 ส่งคู่ขนานทั้งสองกรณี ป้องกัน Frontend แกะค่าพลาด
  }));

  // 5. ส่งโครงสร้างวัตถุบริสุทธิ์กลับไปที่ระบบควบคุม
  return res.status(200).json({ 
    success: true, 
    week, 
    records: standardizedRecords, 
    total_students: totalStudents ?? 0 
  });
}

export default withAdminAuth(handler);