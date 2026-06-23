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
  async function handleUpdateStatus(recordId, targetStatus) {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: recordId, status: targetStatus })
      });
      
      if (res.ok) {
        // Refresh local array records states to mirror database metrics instantly
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, verification_status: targetStatus } : r));
      } else {
        alert('Failed updating transaction state metrics');
      }
    } catch {
      alert('Network transaction mutation exception error caught.');
    }
  }
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
        // Inside your array mapping function loop returning row components:
        {records.map((studentRow) => (
          <tr key={studentRow.id} style={{ 
            backgroundColor: studentRow.verification_status === 'rejected' ? '#fee2e2' : 'transparent' 
          }}>
            <td>{studentRow.student_id}</td>
            <td>{studentRow.student_name}</td>
            <td>{studentRow.answer}</td>
            
            {/* Dynamic Media Render Frame */}
            <td>
              {studentRow.photo_url ? (
                <a href={studentRow.photo_url} target="_blank" rel="noreferrer">
                  <img 
                    src={studentRow.photo_url} 
                    alt="Proof signature" 
                    style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }} 
                  />
                </a>
              ) : (
                <span className="text-muted">No image uploaded</span>
              )}
            </td>

            {/* Live Validation Verification Toggle Interface */}
            <td>
              <span className={`status-badge ${studentRow.verification_status}`}>
                {studentRow.verification_status === 'pending' && '⏳ รอการตรวจสอบ'}
                {studentRow.verification_status === 'approved' && '✅ ผ่านการตรวจสอบ'}
                {studentRow.verification_status === 'rejected' && '❌ ถูกปฏิเสธ (Invalid)'}
              </span>
            </td>

            {/* Admin Mutation Actions Interface */}
            <td>
              <div style={{ display: 'flex', gap: '5px' }}>
                {studentRow.verification_status !== 'approved' && (
                  <button 
                    className="btn btn-success btn-small"
                    onClick={() => handleUpdateStatus(studentRow.id, 'approved')}
                  >
                    Approve
                  </button>
                )}
                {studentRow.verification_status !== 'rejected' && (
                  <button 
                    className="btn btn-danger btn-small"
                    onClick={() => handleUpdateStatus(studentRow.id, 'rejected')}
                    style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminShell>
    </>
  );
}
