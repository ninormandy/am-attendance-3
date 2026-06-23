import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function WeekDashboardPage() {
  const router = useRouter();
  const { id } = router.query;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch week metrics and records
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/weeks/detail?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRecords(data.records || []);
        } else {
          setError(data.error || 'Failed to load records');
        }
      })
      .catch(() => setError('Network error occurred'))
      .finally(() => setLoading(false));
  }, [id]);

  // Handle manual verification override
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
        alert('Failed to update status parameters.');
      }
    } catch {
      alert('Network transmission mutation error caught.');
    }
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <Head>
        <title>Admin Dashboard — Week {id}</title>
      </Head>

      <h2>ระบบตรวจสอบหลักฐานภาพถ่ายประจำสัปดาห์ (Week {id})</h2>
      
      {loading && <p>กำลังโหลดข้อมูล…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb' }}>รหัสนักเรียน</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb' }}>ชื่อ-นามสกุล</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb' }}>คำตอบควิซ</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb' }}>ภาพถ่ายหลักฐาน (Proof)</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb' }}>สถานะการตรวจสอบ</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e5e7eb' }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                  ยังไม่มีข้อมูลการเช็คชื่อในสัปดาห์นี้
                </td>
              </tr>
            ) : (
              records.map((studentRow) => (
                <tr 
                  key={studentRow.id} 
                  style={{ 
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: studentRow.verification_status === 'rejected' ? '#fee2e2' : 'transparent'
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{studentRow.student_id}</td>
                  <td style={{ padding: '12px' }}>{studentRow.student_name}</td>
                  <td style={{ padding: '12px' }}>{studentRow.answer || '-'}</td>
                  
                  {/* 📸 FIXED MEDIA CONTAINER CELL */}
                  {/* We securely verify against both underscore and camelCase formatting variables */}
                  <td style={{ padding: '12px' }}>
                    {studentRow.photo_url || studentRow.photoUrl ? (
                      <a 
                        href={studentRow.photo_url || studentRow.photoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <img 
                          src={studentRow.photo_url || studentRow.photoUrl} 
                          alt="Proof of presence" 
                          style={{ 
                            width: '75px', 
                            height: '50px', 
                            objectFit: 'cover', 
                            borderRadius: '4px', 
                            border: '1px solid #d1d5db',
                            display: 'block'
                          }}
                          onError={(e) => {
                            // Fallback handler if url structure points to an empty bucket location
                            e.target.onerror = null;
                            e.target.src = 'https://placehold.co/75x50/fee2e2/991b1b?text=Broken+Link';
                          }}
                        />
                      </a>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>ไม่มีไฟล์ภาพอัปโหลด</span>
                    )}
                  </td>

                  {/* STATUS FRAME CONTAINER */}
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      backgroundColor: 
                        studentRow.verification_status === 'approved' ? '#d1fae5' :
                        studentRow.verification_status === 'rejected' ? '#fee2e2' : '#fef3c7',
                      color: 
                        studentRow.verification_status === 'approved' ? '#065f46' :
                        studentRow.verification_status === 'rejected' ? '#991b1b' : '#92400e',
                    }}>
                      {studentRow.verification_status === 'pending' && '⏳ รอตรวจ'}
                      {studentRow.verification_status === 'approved' && '✅ อนุมัติ'}
                      {studentRow.verification_status === 'rejected' && '❌ ปฏิเสธ'}
                    </span>
                  </td>

                  {/* INTERACTION ACTION PANEL */}
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleUpdateStatus(studentRow.id, 'approved')}
                        disabled={studentRow.verification_status === 'approved'}
                        style={{
                          backgroundColor: '#10b981', color: 'white', border: 'none', 
                          padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'
                        }}
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(studentRow.id, 'rejected')}
                        disabled={studentRow.verification_status === 'rejected'}
                        style={{
                          backgroundColor: '#ef4444', color: 'white', border: 'none', 
                          padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}