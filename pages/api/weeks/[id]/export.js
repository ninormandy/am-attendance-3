// pages/api/admin/weeks/[id]/export.js
// 🛡️ Production-Grade ExcelJS Telemetry Export Engine by Dr.Hackerman
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  // Fetch target week properties
  const { data: week, error: weekErr } = await supabaseAdmin
    .from('weeks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (weekErr) return res.status(500).json({ error: weekErr.message });
  if (!week) return res.status(404).json({ error: 'ไม่พบสัปดาห์นี้' });

  // Fetch all students (full roster) to calculate exact absence matrix
  const { data: students, error: stuErr } = await supabaseAdmin
    .from('students')
    .select('student_id, name')
    .order('student_id', { ascending: true });
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  // 🎯 [CRITICAL REFACTOR] ดึงข้อมูลบันทึกเข้าเรียนพร้อมบังคับดึงฟิลด์สืบสวนพฤติกรรมออกมาจากตารางตรง ๆ 
  const { data: records, error: recErr } = await supabaseAdmin
    .from('attendance_records')
    .select('student_id, student_name, answer, seconds_taken, submitted_at, verification_status, verification_notes')
    .eq('week_id', id);
  if (recErr) return res.status(500).json({ error: recErr.message });

  // Map student_id → record for high-speed O(1) memory lookup
  const recordMap = {};
  for (const r of records) recordMap[r.student_id] = r;

  // Build high-performance Excel Workbook structure
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AM Attendance';
  wb.created = new Date();

  const ws = wb.addWorksheet(`สัปดาห์ ${week.week_number}`);

  // Header configuration mapping coordinates
  ws.columns = [
    { header: 'รหัสนักเรียน', key: 'student_id', width: 16 },
    { header: 'ชื่อ-นามสกุล', key: 'name', width: 28 },
    { header: 'สถานะเข้าเรียน', key: 'status', width: 14 },
    { header: 'เวลาเช็คชื่อ', key: 'time', width: 20 },
    { header: 'ใช้เวลา (วินาที)', key: 'seconds', width: 16 },
    { header: 'คำตอบควิซ', key: 'answer', width: 40 },
    // 🎯 ขยายคอลัมน์เพิ่มเติมเพื่อรองรับค่าบันทึกลายนิ้วมือดิจิทัลเข้าสู่ตัวเล่ม
    { header: 'สถานะ', key: 'verification_status', width: 28 },
    { header: 'หมายเหตุ', key: 'verification_notes', width: 45 },
  ];

  // Initial Style configuration for Row 1 (Will be shifted to Row 3 later)
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FFE8B23D' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF15171C' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;

  // Data rows — iterate full roster so absent students appear too
  for (const student of students) {
    const rec = recordMap[student.student_id];
    const present = !!rec;

    // ล้างและแปลงข้อความสถานะภาษาอังกฤษให้เป็นคำไทยที่อ่านง่ายบน Excel
    let statusText = '-';
    if (present) {
      if (rec.verification_status === 'approved') statusText = 'อนุมัติ';
      if (rec.verification_status === 'rejected') statusText = 'ปฏิเสธ';
      if (rec.verification_status === 'flagged') statusText = 'ตรวจพบภาพซ้ำ';
      if (rec.verification_status === 'suspicious') statusText = 'ตรวจพบอุปกรณ์ซ้ำ';
      if (rec.verification_status === 'pending') statusText = 'รอตรวจสอบ';
    }

    const row = ws.addRow({
      student_id: student.student_id,
      name: present ? rec.student_name : student.name,
      status: present ? 'มาเรียน' : 'ขาดเรียน',
      time: present
        ? new Date(rec.submitted_at).toLocaleString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '-',
      seconds: present ? rec.seconds_taken ?? '-' : '-',
      answer: present ? (rec.answer ?? '') : '-',
      // 🎯 ผูกค่าข้อมูลความปลอดภัยส่งเข้าสู่เซลล์ของ Row
      verification_status: statusText,
      verification_notes: present ? (rec.verification_notes ?? 'ปกติ') : '-'
    });

    // Color matrix evaluation for status columns
    const statusCell = row.getCell('status');
    const vStatusCell = row.getCell('verification_status');

    if (!present) {
      statusCell.font = { color: { argb: 'FFD6493B' }, name: 'Arial', bold: true };
    } else {
      statusCell.font = { color: { argb: 'FF4F9D69' }, name: 'Arial', bold: true };
      
      // เพิ่มสีสันแจ้งเตือนคอลัมน์สถานะความปลอดภัยในเล่ม Excel ตามระเบียบแบคเอนด์
      if (rec.verification_status === 'flagged' || rec.verification_status === 'rejected') {
        vStatusCell.font = { color: { argb: 'FFD6493B' }, name: 'Arial', bold: true };
      } else if (rec.verification_status === 'suspicious') {
        vStatusCell.font = { color: { argb: 'FFF59E0B' }, name: 'Arial', bold: true };
      } else if (rec.verification_status === 'approved') {
        vStatusCell.font = { color: { argb: 'FF4F9D69' }, name: 'Arial' };
      }
    }
    row.font = { name: 'Arial', size: 10 };
  }

  // Summary row logic blocks
  ws.addRow([]);
  const presentCount = records.length;
  const absentCount = (students.length) - presentCount;
  const summaryRow = ws.addRow([
    '',
    `รวม: ${students.length} คน`,
    `มาเรียน: ${presentCount}   ขาดเรียน: ${absentCount}`,
  ]);
  summaryRow.font = { bold: true, italic: true, name: 'Arial', size: 10 };

  // Inject structural titles and shift columns layout
  ws.spliceRows(1, 0,
    [`สัปดาห์ที่ ${week.week_number} — ${week.question}`],
    [],
  );
  
  ws.getRow(1).font = { bold: true, name: 'Arial', size: 12 };
  ws.getRow(1).height = 20;

  // 🎯 Re-syncing configurations across Row 3 (The real shifted header coordinates)
  const hdr = ws.getRow(3);
  hdr.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FFE8B23D' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15171C' } };
  hdr.alignment = { horizontal: 'center', vertical: 'middle' };

  // Streaming clean binary buffer back over the framework wire
  const buffer = await wb.xlsx.writeBuffer();

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance-week-${week.week_number}.xlsx"`
  );
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(Buffer.from(buffer));
}

export default withAdminAuth(handler);