import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function CheckInPage() {
  const [step, setStep] = useState('loading');
  const [week, setWeek] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [answer, setAnswer] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Load active week session
  useEffect(() => {
    fetch('/api/attendance/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.open) {
          setWeek(data.week);
          const deviceLock = localStorage.getItem(`submitted_week_${data.week.id}`);
          setStep(deviceLock ? 'already' : 'capture_proof');
        } else {
          setStep('closed');
        }
      })
      .catch(() => setStep('closed'));
  }, []);

  // Capture image manipulation event handler
  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // SECURITY GATES: Enforce image execution verification parameters
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น / Valid image inputs only.');
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhotoAndRetake = () => {
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim() || !answer.trim() || !photo) {
      return alert('กรุณากรอกข้อมูลและถ่ายรูปหลักฐานให้ครบถ้วน');
    }

    setSubmitting(true);
    setSubmitError('');

    // 1. Stage image file payload within binary multipart forms
    const formData = new FormData();
    formData.append('week_id', week.id);
    formData.append('student_id', studentId.trim());
    formData.append('answer', answer.trim());
    formData.append('photo', photo);
    formData.append('fingerprint', btoa(navigator.userAgent + screen.colorDepth));

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        body: formData, // Next.js API processes automatically via multipart requests
      });
      const data = await res.json();

      if (res.status === 409) {
        localStorage.setItem(`submitted_week_${week.id}`, 'true');
        setStep('already');
      } else if (!res.ok) {
        setSubmitError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      } else {
        localStorage.setItem(`submitted_week_${week.id}`, 'true');
        setStep('done');
      }
    } catch {
      setSubmitError('ระบบเครือข่ายขัดข้อง กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head><title>เข้าเรียนด้วยภาพถ่าย — AM Attendance</title></Head>
      <div className="page">
        <div className="page-header">
          <div className="brand">AM ATTENDANCE</div>
          <div className="brand-sub">ระบบเช็คชื่อด้วยหลักฐานภาพถ่ายห้องเรียน</div>
        </div>

        {step === 'loading' && <p className="text-muted">กำลังโหลดระบบ…</p>}

        {step === 'closed' && <p className="text-muted">ไม่มีการเช็คชื่อที่เปิดอยู่ในขณะนี้</p>}

        {step === 'capture_proof' && week && (
          <div className="ticket" style={{ padding: '1.5rem' }}>
            <h2>สัปดาห์ที่ {week.week_number}: ถ่ายรูปหน้าชั้นเรียน</h2>
            <p className="text-muted mb-3">คำถามสัปดาห์นี้: {week.question}</p>
            
            <form onSubmit={handleAttendanceSubmit}>
              <div className="field">
                <label>รหัสนักเรียน</label>
                <input 
                  type="text" 
                  value={studentId} 
                  onChange={(e) => setInputId(e.target.value)}
                  placeholder="กรอกรหัสนักเรียนของคุณ" 
                  required 
                />
              </div>

              <div className="field">
                <label>คำตอบประจำสัปดาห์</label>
                <input 
                  type="text" 
                  value={answer} 
                  onChange={(e) => setAnswer(e.target.value)} 
                  placeholder="พิมพ์คำตอบประจำสัปดาห์ที่นี่"
                  required 
                />
              </div>

              <div className="field" style={{ margin: '1.5rem 0' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>รูปถ่ายหลักฐาน:</label>
                
                {!photoPreview ? (
                  <label className="btn btn-marquee btn-full" style={{ textAlign: 'center', cursor: 'pointer' }}>
                    📷 เปิดกล้องถ่ายภาพห้องเรียน
                    {/* CRITICAL ATTRIBUTES: 'capture="environment"' strictly locks the input to the device live camera layout */}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handlePhotoCapture} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <img 
                      src={photoPreview} 
                      alt="Preview proof" 
                      style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '8px' }} 
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                      <button type="button" className="btn btn-ghost-dark btn-full" onClick={clearPhotoAndRetake}>
                        🔄 ถ่ายใหม่ (Retake)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {submitError && <p className="error-text">{submitError}</p>}

              <button type="submit" className="btn btn-marquee btn-full mt-2" disabled={submitting || !photo}>
                {submitting ? 'กำลังส่งหลักฐานการเข้าเรียน…' : 'ยืนยันและเช็คชื่อเข้าเรียน ✓'}
              </button>
            </form>
          </div>
        )}

        {step === 'done' && <div className="ticket" style={{ textAlign: 'center', padding: '2rem' }}><h2>เช็คชื่อสำเร็จแล้ว!</h2><p>ระบบบันทึกภาพถ่ายหลักฐานของคุณเรียบร้อยแล้ว สามารถปิดหน้านี้ได้เลย</p></div>}
        {step === 'already' && <div className="ticket" style={{ textAlign: 'center', padding: '2rem' }}><h2>อุปกรณ์นี้เช็คชื่อไปแล้ว</h2><p>หนึ่งเครื่องไม่สามารถส่งรายชื่อเข้าเรียนซ้ำได้ในสัปดาห์นี้</p></div>}
      </div>
    </>
  );
}