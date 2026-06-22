import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  // Fetch week
  const { data: week, error: weekErr } = await supabaseAdmin
    .from('weeks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (weekErr) return res.status(500).json({ error: weekErr.message });
  if (!week) return res.status(404).json({ error: 'ไม่พบสัปดาห์นี้' });

  // Fetch all students (full roster)
  const { data: students, error: stuErr } = await supabaseAdmin
    .from('students')
    .select('student_id, name')
    .order('student_id', { ascending: true });
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  // Fetch attendance records for this week
  const { data: records, error: recErr } = await supabaseAdmin
    .from('attendance_records')
    .select('student_id, student_name, answer, seconds_taken, submitted_at')
    .eq('week_id', id);
  if (recErr) return res.status(500).json({ error: recErr.message });

  // Map student_id → record for O(1) lookup
  const recordMap = {};
  for (const r of records) recordMap[r.student_id] = r;

  // Build workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AM Attendance';
  wb.created = new Date();

  const ws = wb.addWorksheet(`สัปดาห์ ${week.week_number}`);

  // Header row
  ws.columns = [
    { header: 'รหัสนักเรียน', key: 'student_id', width: 16 },
    { header: 'ชื่อ-นามสกุล', key: 'name', width: 28 },
    { header: 'สถานะ', key: 'status', width: 14 },
    { header: 'เวลาเช็คชื่อ', key: 'time', width: 20 },
    { header: 'ใช้เวลา (วินาที)', key: 'seconds', width: 16 },
    { header: 'คำตอบ', key: 'answer', width: 40 },
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, name: 'Arial', size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF15171C' },
  };
  headerRow.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FFE8B23D' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;

  // Data rows — iterate full roster so absent students appear too
  for (const student of students) {
    const rec = recordMap[student.student_id];
    const present = !!rec;

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
    });

    // Highlight absent rows faintly
    if (!present) {
      row.getCell('status').font = { color: { argb: 'FFD6493B' }, name: 'Arial' };
    } else {
      row.getCell('status').font = { color: { argb: 'FF4F9D69' }, name: 'Arial' };
    }
    row.font = { name: 'Arial', size: 10 };
  }

  // Summary row
  ws.addRow([]);
  const presentCount = records.length;
  const absentCount = (students.length) - presentCount;
  const summaryRow = ws.addRow([
    '',
    `รวม: ${students.length} คน`,
    `มาเรียน: ${presentCount}  ขาดเรียน: ${absentCount}`,
  ]);
  summaryRow.font = { bold: true, italic: true, name: 'Arial', size: 10 };

  // Week info above header
  ws.spliceRows(1, 0,
    [`สัปดาห์ที่ ${week.week_number} — ${week.question}`],
    [],
  );
  ws.getRow(1).font = { bold: true, name: 'Arial', size: 12 };
  ws.getRow(1).height = 20;
  // Shift header now to row 3 (rows 1+2 inserted)
  const hdr = ws.getRow(3);
  hdr.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FFE8B23D' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15171C' } };
  hdr.alignment = { horizontal: 'center', vertical: 'middle' };

  // Send response
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
