// pages/admin/weeks/[id].js
// 🛡️ Live Forensics Telemetry Dashboard v2 by Dr.Hackerman
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
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, verification_status: targetStatus } : r));
      } else {
        alert('อัปเดตสถานะไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
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

  async function handleDeleteWeek() {
    const confirmed = window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสัปดาห์นี้? การลบจะทำลายข้อมูลภาพถ่ายและประวัติการเช็คชื่อทั้งหมดในสัปดาห์นี้อย่างถาวร');
    if (!confirmed) return;

    setActionError('');
    try {
      const res = await fetch(`/api/weeks/${id}/delete`, { method: 'DELETE' });
      if (res.ok) {
        alert('ลบสัปดาห์เรียบร้อยแล้ว');
        router.push('/admin/dashboard');
      } else {
        const data = await res.json();
        setActionError(data.error || 'ไม่สามารถลบสัปดาห์ได้');
      }
    } catch {
      setActionError('เกิดข้อผิดพลาดระบบเครือข่ายในการลบข้อมูล');
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
        <div className="action-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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

          <button 
            className="btn btn-danger btn-ghost" 
            onClick={handleDeleteWeek}
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            🗑️ ลบสัปดาห์นี้
          </button>

          <button className="btn btn-ghost" onClick={() => router.push('/admin/dashboard')} style={{ marginLeft: 'auto' }}>
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
            <table style={{ width: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th style={{ width: '120px' }}>รหัสนักเรียน</th>
                  <th style={{ minWidth: '180px' }}>ชื่อ-นามสกุล</th>
                  <th style={{ width: '110px' }}>เวลาเช็คชื่อ</th>
                  <th style={{ width: '90px' }}>ภาพหลักฐาน</th>
                  <th style={{ minWidth: '220px' }}>คำตอบ</th>
                  <th style={{ minWidth: '260px' }}>ข้อสังเกต</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>สถานะการตรวจสอบ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr 
                    key={r.id} 
                    className={
                      r.verification_status === 'rejected' 
                        ? 'rejected-row' 
                        : r.verification_status === 'flagged'
                        ? 'flagged-row'
                        : r.verification_status === 'suspicious'
                        ? 'suspicious-row'
                        : ''
                    }
                    style={{
                      backgroundColor:
                        r.verification_status === 'rejected'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : r.verification_status === 'flagged'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : r.verification_status === 'suspicious'
                          ? 'rgba(245, 158, 11, 0.06)'
                          : 'inherit'
                    }}
                  >
                    <td className="mono text-muted">{i + 1}</td>
                    <td className="mono">{r.student_id}</td>
                    
                    <td style={{ whiteSpace: 'nowrap', fontWeight: '500' }}>
                      {r.student_name}
                    </td>
                    
                    <td className="mono">
                      {new Date(r.submitted_at).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    
                    <td>
                      {r.photo_url || r.photoUrl ? (
                        <a href={r.photo_url || r.photoUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={r.photo_url || r.photoUrl} 
                            alt="Proof" 
                            style={{ width: '50px', height: '35px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://placehold.co/50x35/fee2e2/991b1b?text=Error';
                            }}
                          />
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td style={{ fontSize: '0.88rem', lineHeight: '1.5', paddingRight: '20px' }}>
                      {r.answer || <span className="text-muted">—</span>}
                    </td>

                    {/* 🎯 [EXACT TEXT RESOLUTION] แก้ไขตรรกะตัวเช็ค: แสดงสายตรงจากคีย์ Supabase จริงเท่านั้น ห้ามลวงสเตต */}
                    <td style={{ 
                      fontSize: '0.88rem', 
                      fontWeight: (r.verification_notes || r.verificationNotes) ? '600' : 'normal',
                      color: r.verification_status === 'flagged' ? '#ef4444' : r.verification_status === 'suspicious' ? '#f59e0b' : 'inherit'
                    }}>
                      {/* บังคับให้อ่านจากค่าจริงใน Database ตรง ๆ หากไม่มีค่าจริง ๆ ค่อยขึ้นตัวหนังสือสีจางว่าปกติ */}
                      {(r.verification_notes || r.verificationNotes) ? (
                        r.verification_notes || r.verificationNotes
                      ) : (
                        <span className="text-muted" style={{ fontStyle: 'italic', fontWeight: 'normal' }}>CLEAN: ปกติ</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {r.verification_status === 'pending' || r.verification_status === 'flagged' || r.verification_status === 'suspicious' ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-ghost" 
                            onClick={() => handleUpdateStatus(r.id, 'approved')}
                            style={{ padding: '4px 10px', fontSize: '0.8rem', height: 'auto', color: '#10b981', fontWeight: 'bold' }}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-ghost" 
                            onClick={() => handleUpdateStatus(r.id, 'rejected')}
                            style={{ padding: '4px 10px', fontSize: '0.8rem', height: 'auto', color: '#ef4444', fontWeight: 'bold' }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`badge badge-${r.verification_status === 'approved' ? 'open' : 'closed'}`} style={{ display: 'inline-block', minWidth: '85px', textAlign: 'center' }}>
                          {r.verification_status === 'approved' ? '✅ อนุมัติ' : '❌ ปฏิเสธ'}
                        </span>
                      )}
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