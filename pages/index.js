import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const CHECKIN_SECONDS = 300; // 5-minute quiz window

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CheckInPage() {
  // step: 'loading' | 'pc_blocked' | 'closed' | 'capture' | 'entry' | 'quiz' | 'done' | 'already'
  const [step, setStep] = useState('loading');
  const [week, setWeek] = useState(null);

  // Capture step
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Entry step
  const [inputId, setInputId] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);

  // Quiz step
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(CHECKIN_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Done step
  const [doneRecord, setDoneRecord] = useState(null);

  const answerRef = useRef('');
  useEffect(() => { answerRef.current = answer; }, [answer]);

  // Helper utility: Compute client-side hardware fingerprint
  function getDeviceFingerprint() {
    if (typeof window === 'undefined') return '';
    const hardwareToken = 
      navigator.userAgent + 
      (navigator.hardwareConcurrency || 2) + 
      screen.colorDepth + 
      screen.width;
    return btoa(hardwareToken);
  }

  // Load active week session
  useEffect(() => {
    fetch('/api/attendance/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.open && data.week && data.week.id) {
          setWeek(data.week);
          setStep('capture');
        } else {
          setStep('closed');
        }
      })
      .catch(() => setStep('closed'));
  }, []);

  // Countdown timer — ONLY starts when step becomes 'quiz'
  useEffect(() => {
    if (step !== 'quiz') return;
    setTimeLeft(CHECKIN_SECONDS);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitAnswer(0, answerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Handle Photo Capture
  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhotoAndRetake = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleConfirmPhoto = (e) => {
    e.preventDefault();
    if (!photo) return alert('กรุณาถ่ายรูปภาพหลักฐานก่อนเข้าหน้าถัดไป');
    setStep('entry'); 
  };

  async function handleLookup(e) {
    e.preventDefault();
    if (!week || !week.id) {
      alert('ระบบกำลังดึงข้อมูลเซสชันสัปดาห์เรียน กรุณารอสักครู่แล้วกดใหม่อีกครั้งครับ');
      return;
    }

    setLookupError('');
    setLooking(true);

    try {
      const res = await fetch(`/api/attendance/lookup?student_id=${encodeURIComponent(inputId.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'ไม่พบรหัสนักศึกษานี้');
      } else {
        setStudentId(data.student.student_id);
        setStudentName(data.student.name);
        setAnswer('');
        setSubmitError('');
        setStep('quiz');
      }
    } catch {
      setLookupError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
    } finally {
      setLooking(false);
    }
  }

  async function submitAnswer(secondsUsedOverride, answerOverride) {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    
    const secondsTaken =
      secondsUsedOverride != null
        ? CHECKIN_SECONDS - secondsUsedOverride
        : Math.max(0, CHECKIN_SECONDS - timeLeft);

    const fingerprint = getDeviceFingerprint();

    const formData = new FormData();
    formData.append('week_id', week.id);
    formData.append('student_id', studentId);
    formData.append('answer', answerOverride !== undefined ? answerOverride : answer);
    formData.append('seconds_taken', String(secondsTaken));
    formData.append('photo', photo);
    formData.append('fingerprint', fingerprint);

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      // 🎯 [FIXED BY DR.HACKERMAN] สถาปัตยกรรมการคัดกรองแบบแบ่งแยกเด็ดขาด ไม่ใช้ตรรกะเหมาเข่ง
      if (res.status === 200 || res.status === 201) {
        if (data.success === true || data.ok === true) {
          // บันทึกสำเร็จจริงผ่าน Relational Database
          setDoneRecord(data.record);
          setStep('done');
          return; // ยุติการทำงานทันที ป้องกันการหลุดไหลไปเงื่อนไขอื่น
        }
      }
      
      // จัดการเคสทุจริต/ส่งซ้ำเฉพาะเจาะจง (HTTP 409 Conflict)
      if (res.status === 409 || data.code === 'DUPLICATE_ATTENDANCE') {
        setStep('already');
      } else if (res.status === 403) {
        setSubmitError(data.error || 'การเช็คชื่อถูกปิดแล้ว กรุณาติดต่ออาจารย์ผู้สอน');
        setStep('closed');
      } else {
        // เคสข้อผิดพลาดทั่วไป เช่น อัปโหลดไฟล์พัง หรือเซิร์ฟเวอร์ขัดข้อง
        setSubmitError(data.error || 'ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } catch {
      setSubmitError('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false); // ปลดล็อกปุ่มในกรณีที่ระบบ Error เพื่อให้เด็กกดส่งใหม่ได้
    }
  }

  async function handleSubmitClick(e) {
    e.preventDefault();
    submitAnswer(null, answer);
  }

  return (
    <>
      <Head>
        <title>เช็คชื่อ — AM Attendance</title>
      </Head>

      <div className="page">
        <div className="page-header">
          <div className="brand">AM ATTENDANCE</div>
          <div className="brand-sub">ระบบเช็คชื่อนักศึกษา</div>
        </div>

        {/* ── LOADING ── */}
        {step === 'loading' && <p className="text-muted">กำลังโหลด…</p>}

        {/* ── CLOSED ── */}
        {step === 'closed' && (
          <div className="ticket" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="ticket-stub" style={{ justifyContent: 'center' }}>
              <span className="status-dot" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--stage-border)' }}>
                ไม่มีการเช็คชื่อเปิดอยู่ในขณะนี้
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--ink-mid)', fontSize: '0.9rem' }}>
                กรุณารอจนกว่าอาจารย์ผู้สอนจะเปิดการเช็คชื่อ แล้วรีเฟรชหน้านี้
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 1: CAMERA PROOF BASE CAPTURE ── */}
        {step === 'capture' && week && (
          <div className="ticket">
            <div className="ticket-stub">
              <div>
                <div className="wk-label">สัปดาห์ที่</div>
                <div className="wk-num">{week.week_number}</div>
              </div>
              <div className="stub-info">
                <div className="stub-title">
                  <span className="status-dot live" />
                  ขั้นตอนที่ 1: ถ่ายภาพตนเองในชั้นเรียน
                </div>
                <div className="stub-meta">กรุณาแนบรูปภาพเพื่อเข้าทำควิซประจำสัปดาห์</div>
              </div>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ textAlign: 'center' }}>
              {!photoPreview ? (
                <div style={{ padding: '1.5rem 0' }}>
                  <p style={{ marginBottom: '1.5rem', color: 'var(--ink-mid)' }}>
                    กรุณากดปุ่มด้านล่างเพื่อเปิดกล้อง และถ่ายภาพเซลฟี่ให้เห็นอาจารย์ผู้สอนเพื่อเป็นหลักฐานการเข้าเรียน
                  </p>
                  <label className="btn btn-marquee btn-full" style={{ display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                    📷 เปิดกล้องถ่ายภาพ
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handlePhotoCapture} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <img 
                    src={photoPreview} 
                    alt="Captured workspace proof" 
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--stage-border)' }} 
                  />
                  <p style={{ margin: '1rem 0', color: 'var(--ok-green)', fontWeight: 600 }}>
                    ✓ บันทึกภาพสำเร็จ คุณต้องการใช้ภาพนี้หรือไม่?
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn btn-ghost-dark btn-full" onClick={clearPhotoAndRetake}>
                      🔄 ถ่ายใหม่ (Retake)
                    </button>
                    <button type="button" className="btn btn-marquee btn-full" onClick={handleConfirmPhoto}>
                      ถัดไป: กรอกรหัส →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: ENTRY (student ID input) ── */}
        {step === 'entry' && week && (
          <div className="ticket">
            <div className="ticket-stub">
              <div>
                <div className="wk-label">สัปดาห์ที่</div>
                <div className="wk-num">{week.week_number}</div>
              </div>
              <div className="stub-info">
                <div className="stub-title">ขั้นตอนที่ 2: รหัสนักศึกษา</div>
                <div className="stub-meta">กรอกรหัสประจำตัวของคุณเพื่อเริ่มทำควิซ</div>
              </div>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body">
              <form onSubmit={handleLookup}>
                <div className="field">
                  <label htmlFor="student-id">รหัสนักศึกษา</label>
                  <input
                    id="student-id"
                    type="text"
                    value={inputId}
                    onChange={(e) => setInputId(e.target.value)}
                    placeholder="กรอกรหัสนักศึกษาของคุณ"
                    autoComplete="off"
                    autoFocus
                    required
                  />
                </div>
                {lookupError && <p className="error-text">{lookupError}</p>}
                <button type="submit" className="btn btn-marquee btn-full mt-1" disabled={looking}>
                  {looking ? 'กำลังตรวจสอบ…' : 'เข้าสู่หน้าควิซ & เริ่มจับเวลา ⏱️'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── STEP 3: QUIZ ── */}
        {step === 'quiz' && week && (
          <div className="ticket">
            <div className="ticket-stub">
              <div>
                <div className="wk-label">สัปดาห์ที่</div>
                <div className="wk-num">{week.week_number}</div>
              </div>
              <div className="stub-info">
                <div className="stub-title">{studentName}</div>
                <div className="stub-meta mono">{studentId}</div>
              </div>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body">
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>เวลาที่เหลือ</div>
                <div className={`timer${timeLeft <= 30 ? ' warn' : ''}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>

              <div className="question-box">{week.question}</div>

              <form onSubmit={handleSubmitClick}>
                <div className="field">
                  <label htmlFor="answer">คำตอบของคุณ</label>
                  <textarea
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="พิมพ์คำตอบที่นี่…"
                    rows={4}
                    disabled={submitting}
                  />
                </div>
                {submitError && <p className="error-text">{submitError}</p>}
                <button type="submit" className="btn btn-marquee btn-full" disabled={submitting}>
                  {submitting ? 'กำลังบันทึก…' : 'ส่งคำตอบ & เช็คชื่อ ✓'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="ticket" style={{ textAlign: 'center' }}>
            <div className="ticket-stub" style={{ justifyContent: 'center', flexDirection: 'column', alignItems: 'center', padding: '1.5rem' }} >
              <span className="status-dot ok" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ok-green)', marginTop: '0.4rem' }}>
                ส่งข้อมูลหลักฐานสำเร็จ
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>{studentName || 'ลงทะเบียนสำเร็จ'}</p>
              <p className="mono" style={{ color: 'var(--ink-mid)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{studentId}</p>
              <p className="mt-3" style={{ color: 'var(--ink-mid)', fontSize: '0.9rem' }}>
                ระบบได้แนบภาพถ่ายหลักฐานของคุณส่งให้อาจารย์ผู้สอนเรียบร้อยแล้ว สามารถปิดหน้านี้ได้เลยครับ
              </p>
            </div>
          </div>
        )}

        {/* ── ALREADY CHECKED IN ── */}
        {step === 'already' && (
          <div className="ticket" style={{ textAlign: 'center' }}>
            <div className="ticket-stub" style={{ justifyContent: 'center' }}>
              <span className="status-dot ok" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--marquee-soft)' }}>
                รหัสนักศึกษานี้เช็คชื่อแล้ว
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--ink)', fontWeight: 600 }}>ล้มเหลว: ตรวจพบข้อมูลการส่งซ้ำ</p>
              <p className="text-muted mt-1" style={{ fontSize: '0.88rem' }}>
                รหัสนักศึกษานี้ได้ทำการส่งข้อมูลและบันทึกเวลาเข้าเรียนในสัปดาห์นี้ไปเรียบร้อยแล้ว ไม่สามารถส่งคำตอบซ้ำได้อีกครับ
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}