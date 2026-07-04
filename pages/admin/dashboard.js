import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminShell from '../../components/AdminShell';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Fetch all weeks to populate the list dashboard
  async function fetchWeeksList() {
    try {
      const res = await fetch('/api/admin/weeks'); // Your endpoint that returns the weeks array
      if (res.ok) {
        const data = await res.json();
        setWeeks(data.weeks || []);
      } else {
        setError('ไม่สามารถโหลดข้อมูลสัปดาห์ได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeeksList();
  }, []);

  // 🗑️ NEW FEATURE: Delete handler execution directly from the list item card
  async function handleDeleteWeek(e, weekId, weekNumber) {
    // Prevent the click event from navigating into the week detail page
    e.stopPropagation();

    const confirmed = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "สัปดาห์ที่ ${weekNumber}"? การลบจะทำลายข้อมูลภาพถ่ายหลักฐานและประวัติการเข้าเรียนทั้งหมดอย่างถาวร!`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/weeks/${weekId}/delete`, { method: 'DELETE' });
      if (res.ok) {
        alert('ลบสัปดาห์เรียบร้อยแล้ว');
        // Instantly filter out the deleted item from UI state so it disappears smoothly
        setWeeks((prev) => prev.filter((w) => w.id !== weekId));
      } else {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถลบสัปดาห์ได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดของระบบในการลบข้อมูล');
    }
  }

  return (
    <>
      <Head>
        <title>แผงควบคุมหลัก — AM Attendance</title>
      </Head>
      <AdminShell>
        <div className="toolbar">
          <h1 className="toolbar-title">จัดการสัปดาห์การเช็คชื่อ</h1>
          {/* Your button to open the "Create Week" Modal / Page */}
          <button className="btn btn-marquee" onClick={() => router.push('/admin/week/new')}>
            + สร้างสัปดาห์ใหม่
          </button>
        </div>

        {loading && <p className="text-muted">กำลังโหลดข้อมูลรายการสัปดาห์…</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && weeks.length === 0 && (
          <div className="empty-state">
            <p>ยังไม่มีการสร้างสัปดาห์การเรียนการสอน</p>
          </div>
        )}

        {/* Weeks presentation list mapping structure */}
        <div className="weeks-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1.5rem' }}>
          {weeks.map((w) => (
            <div 
              key={w.id} 
              className="card"
              onClick={() => router.push(`/admin/week/${w.id}`)}
              style={{ 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: '2px' }}>สัปดาห์ที่</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--marquee)', lineHeight: 1 }}>
                    {w.week_number}
                  </div>
                </div>
                
                <div>
                  <span className={`badge badge-${w.status === 'open' ? 'open' : 'closed'}`}>
                    {w.status === 'open' ? 'กำลังเปิดเช็คชื่อ' : 'ปิดระบบแล้ว'}
                  </span>
                  <p style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--ink-mid)' }}>
                    คำถาม: {w.question.length > 50 ? `${w.question.substring(0, 50)}...` : w.question}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ textAlign: 'right', marginRight: '10px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--ok-green)' }}>
                    {w.present_count || 0} คน
                  </div>
                  <div className="eyebrow">เช็คชื่อแล้ว</div>
                </div>

                {/* 🗑️ NEW TRASH CAN BUTTON COMPONENT INJECTED */}
                <button
                  className="btn btn-ghost"
                  onClick={(e) => handleDeleteWeek(e, w.id, w.week_number)}
                  style={{
                    padding: '6px 10px',
                    height: 'auto',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.15)',
                    backgroundColor: 'rgba(239, 68, 68, 0.02)',
                    fontSize: '0.85rem'
                  }}
                  title="ลบสัปดาห์นี้ถาวร"
                >
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminShell>
    </>
  );
}