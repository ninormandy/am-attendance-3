import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminShell from '../../../components/AdminShell';

export default function WeekDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [week, setWeek] = useState(null);
  const [records, setRecords] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const intervalRef = useRef(null);

  async function fetchData(silent = false) {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/weeks/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWeek(data.week);
        setRecords(data.records);
        setTotalStudents(data.total_students);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchData();
    // Poll every 3 seconds for live attendance updates
    intervalRef.current = setInterval(() => fetchData(true), 3000);
    return () => clearInterval(intervalRef.current);
  }, [id]);

  async function handleOpen() {
    setActionError('');
    const res = await fetch(`/api/weeks/${id}/open`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error || 'เปิดไม่สำเร็จ');
    } else {
      fetchData(true);
    }
  }

  async function handleClose() {
    setActionError('');
    const res = await fetch(`/api/weeks/${id}/close`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error || 'ปิดไม่สำเร็จ');
    } else {
      fetchData(true);
    }
  }

  if (loading || !week) {
    return (
      <AdminShell>
        <p className="text-muted">กำลังโหลด…</p>
      </AdminShell>
    );
  }

  const isOpen = week.status === 'open';
  const presentCount = records.length;
  const absentCount = totalStudents - presentCount;

  return (
    <>
      <Head>
        <title>สัปดาห์ที่ {week.week_number} — AM Attendance</title>
      </Head>
      <AdminShell>
        {/* Header */}
        <div className="toolbar">
          <div>
            <div className="eyebrow">สัปดาห์ที่</div>
            <h1 className="toolbar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="display" style={{ fontSize: '2.5rem', color: 'var(--marquee)' }}>
                {week.week_number}
              </span>
              {isOpen && <span className="status-dot live" />}
              <span className={`badge badge-${isOpen ? 'open' : 'closed'}`}>
                {isOpen ? 'กำลังเปิด' : 'ปิดแล้ว'}
              </span>
            </h1>
          </div>
        </div>

        {/* Action bar */}
        <div className="action-bar">
          {isOpen ? (
            <button className="btn btn-danger" onClick={handleClose}>
              ⏹ ปิดการเช็คชื่อ
            </button>
          ) : (
            <button className="btn btn-marquee" onClick={handleOpen}>
              ▶ เปิดการเช็คชื่อ
            </button>
          )}

          <a
            href={`/api/weeks/${id}/export`}
            className="btn btn-ghost"
            download
          >
            ↓ Export Excel
          </a>

          <button className="btn btn-ghost" onClick={() => router.push('/admin/dashboard')}>
            ← กลับ
          </button>
        </div>

        {actionError && <p className="error-text mb-2">{actionError}</p>}

        {/* Question */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="eyebrow mb-1">คำถามประจำสัปดาห์</div>
          <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>{week.question}</p>
        </div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--ok-green)' }}>{presentCount}</div>
            <div className="stat-label">มาเรียน</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--live-red)' }}>{absentCount < 0 ? 0 : absentCount}</div>
            <div className="stat-label">ขาดเรียน</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{totalStudents}</div>
            <div className="stat-label">นักเรียนทั้งหมด</div>
          </div>
        </div>

        {/* Attendance records table */}
        {records.length === 0 ? (
          <div className="empty-state">
            {isOpen ? (
              <>
                <div style={{ fontSize: '2rem' }}>⏳</div>
                <p>รอนักเรียนเช็คชื่อ…</p>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.8rem' }}>
                  Dashboard นี้อัปเดตทุก 3 วินาทีโดยอัตโนมัติ
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2rem' }}>📋</div>
                <p>ยังไม่มีการเช็คชื่อในสัปดาห์นี้</p>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>รหัสนักเรียน</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>เวลาเช็คชื่อ</th>
                  <th>ใช้เวลา</th>
                  <th>คำตอบ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id}>
                    <td className="mono text-muted">{i + 1}</td>
                    <td className="mono">{r.student_id}</td>
                    <td>{r.student_name}</td>
                    <td className="mono">
                      {new Date(r.submitted_at).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="mono">
                      {r.seconds_taken != null ? `${r.seconds_taken}s` : '—'}
                    </td>
                    <td style={{ maxWidth: 280, fontSize: '0.85rem', lineHeight: 1.45 }}>
                      {r.answer || <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminShell>
    </>
  );
}
