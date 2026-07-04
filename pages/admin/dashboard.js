import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminShell from '../../components/AdminShell';

export default function DashboardPage() {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [weekNumber, setWeekNumber] = useState('');
  const [question, setQuestion] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchWeeks() {
    const res = await fetch('/api/weeks');
    if (res.ok) {
      const data = await res.json();
      setWeeks(data.weeks);
      // Suggest the next week number
      if (data.weeks.length > 0) {
        const max = Math.max(...data.weeks.map((w) => w.week_number));
        setWeekNumber(String(max + 1));
      } else {
        setWeekNumber('1');
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchWeeks();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_number: Number(weekNumber), question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'สร้างสัปดาห์ไม่สำเร็จ');
      } else {
        setShowForm(false);
        setQuestion('');
        fetchWeeks();
      }
    } catch {
      setFormError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  }

  // Handle deleting a week directly from the card list loop
  async function handleDelete(e, weekId, weekNum) {
    e.preventDefault(); // CRITICAL: Blocks the surrounding <Link> anchor wrapper from redirecting pages
    
    const confirmed = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสัปดาห์ที่ ${weekNum}? ข้อมูลการเช็คชื่อทั้งหมดในสัปดาห์นี้จะถูกลบอย่างถาวร`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/weeks/${weekId}/delete`, { method: 'DELETE' });
      if (res.ok) {
        alert('ลบสัปดาห์เรียบร้อยแล้ว');
        fetchWeeks(); // Refresh layout items array mapping indexes instantly
      } else {
        const data = await res.json();
        alert(data.error || 'ลบไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อลบข้อมูล');
    }
  }

  return (
    <>
      <Head><title>สัปดาห์ทั้งหมด — AM Attendance</title></Head>
      <AdminShell>
        <div className="toolbar">
          <h1 className="toolbar-title">สัปดาห์ทั้งหมด</h1>
          <button
            className="btn btn-marquee"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'ยกเลิก' : '+ สร้างสัปดาห์ใหม่'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ maxWidth: 520 }}>
            <div className="card-title">สร้างสัปดาห์ใหม่</div>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label htmlFor="week-number">สัปดาห์ที่</label>
                <input
                  id="week-number"
                  type="number"
                  min="1"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="question">คำถามประจำสัปดาห์</label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="นักเรียนจะต้องตอบคำถามนี้ขณะเช็คชื่อ…"
                  required
                />
              </div>
              {formError && <p className="error-text">{formError}</p>}
              <button type="submit" className="btn btn-marquee" disabled={saving}>
                {saving ? 'กำลังสร้าง…' : 'สร้างสัปดาห์'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-muted">กำลังโหลด…</p>
        ) : weeks.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem' }}>📋</div>
            <p>ยังไม่มีสัปดาห์ใดในระบบ</p>
            <p>กดปุ่ม "สร้างสัปดาห์ใหม่" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="week-grid">
            {weeks.map((w) => (
              <Link key={w.id} href={`/admin/week/${w.id}`} className="week-card">
                <div className="week-card-head">
                  <div>
                    <div className="wk-num-label">สัปดาห์ที่</div>
                    <div className="wk-num-display">{w.week_number}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      {w.status === 'open' && <span className="status-dot live" />}
                      <span className={`badge badge-${w.status === 'open' ? 'open' : 'closed'}`}>
                        {w.status === 'open' ? 'กำลังเปิด' : 'ปิดแล้ว'}
                      </span>
                    </div>
                    <div className="week-card-meta">
                      {w.status === 'open' && w.opened_at
                        ? `เปิดตั้งแต่ ${new Date(w.opened_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
                        : w.closed_at
                        ? `ปิดเมื่อ ${new Date(w.closed_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`
                        : 'ยังไม่เปิดเช็คชื่อ'}
                    </div>
                  </div>
                </div>

                <div className="week-card-question">{w.question}</div>

                <div className="week-card-footer" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                  <span>มาเรียน {w.present_count} คน</span>
                  
                  {/* Action inline delete button injected inside footer bounds */}
                  <button
                    className="btn btn-ghost"
                    onClick={(e) => handleDelete(e, w.id, w.week_number)}
                    style={{
                      padding: '2px 6px',
                      height: 'auto',
                      fontSize: '0.82rem',
                      color: '#ef4444',
                      borderColor: 'transparent',
                      marginLeft: 'auto'
                    }}
                  >
                    🗑️ ลบ
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminShell>
    </>
  );
}