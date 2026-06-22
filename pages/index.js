import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const CHECKIN_SECONDS = 300; // 5-minute quiz window

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CheckInPage() {
  // step: 'loading' | 'closed' | 'entry' | 'quiz' | 'done' | 'already'
  const [step, setStep] = useState('loading');
  const [week, setWeek] = useState(null);

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

  // answerRef keeps the latest answer for use inside the timer interval
  // without causing a stale closure bug
  const answerRef = useRef('');
  useEffect(() => { answerRef.current = answer; }, [answer]);

  // Load which week is currently open
  useEffect(() => {
    fetch('/api/attendance/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.open) {
          setWeek(data.week);
          setStep('entry');
        } else {
          setStep('closed');
        }
      })
      .catch(() => setStep('closed'));
  }, []);

  // Countdown timer — starts when step becomes 'quiz'
  useEffect(() => {
    if (step !== 'quiz') return;
    setTimeLeft(CHECKIN_SECONDS);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit with whatever the student has typed
          submitAnswer(0, answerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  async function handleLookup(e) {
    e.preventDefault();
    setLookupError('');
    setLooking(true);
    try {
      const res = await fetch(`/api/attendance/lookup?student_id=${encodeURIComponent(inputId.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'ไม่พบรหัสนักเรียนนี้');
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
    const secondsTaken =
      secondsUsedOverride != null
        ? CHECKIN_SECONDS - secondsUsedOverride  // auto-submit at 0
        : CHECKIN_SECONDS - timeLeft;

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_id: week.id,
          student_id: studentId,
          answer: answerOverride !== undefined ? answerOverride : answer,
          seconds_taken: secondsTaken,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setStep('already');
      } else if (res.status === 403) {
        setSubmitError('การเช็คชื่อถูกปิดแล้ว กรุณาติดต่อครู');
        setStep('closed');
      } else if (!res.ok) {
        setSubmitError(data.error || 'ส่งไม่สำเร็จ กรุณาลองใหม่');
        setSubmitting(false);
      } else {
        setDoneRecord(data.record);
        setStep('done');
      }
    } catch {
      setSubmitError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setSubmitting(false);
    }
  }

  async function handleSubmitClick(e) {
    e.preventDefault();
    submitAnswer(null, answer);
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      <Head>
        <title>เช็คชื่อ — AM Attendance</title>
      </Head>

      <div className="page">
        {/* Brand header */}
        <div className="page-header">
          <div className="brand">AM ATTENDANCE</div>
          <div className="brand-sub">ระบบเช็คชื่อนักเรียน</div>
        </div>

        {/* ── LOADING ── */}
        {step === 'loading' && (
          <p className="text-muted">กำลังโหลด…</p>
        )}

        {/* ── CLOSED ── */}
        {step === 'closed' && (
          <div className="ticket" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="ticket-stub" style={{ justifyContent: 'center' }}>
              <span className="status-dot" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--stage-border)' }}>
                ไม่มีการเช็คชื่อที่เปิดอยู่ในขณะนี้
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--ink-mid)', fontSize: '0.9rem' }}>
                กรุณารอจนกว่าครูจะเปิดการเช็คชื่อ แล้วรีเฟรชหน้านี้
              </p>
              <button
                className="btn btn-ghost-dark btn-full mt-2"
                onClick={() => {
                  setStep('loading');
                  fetch('/api/attendance/current')
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.open) { setWeek(data.week); setStep('entry'); }
                      else setStep('closed');
                    })
                    .catch(() => setStep('closed'));
                }}
              >
                ตรวจสอบอีกครั้ง
              </button>
            </div>
          </div>
        )}

        {/* ── ENTRY (student ID input) ── */}
        {step === 'entry' && week && (
          <div className="ticket">
            <div className="ticket-stub">
              <div>
                <div className="wk-label">สัปดาห์ที่</div>
                <div className="wk-num">{week.week_number}</div>
              </div>
              <div className="stub-info">
                <div className="stub-title">
                  <span className="status-dot live" />
                  กำลังรับการเช็คชื่อ
                </div>
                <div className="stub-meta">กรอกรหัสนักเรียนเพื่อเริ่มต้น</div>
              </div>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body">
              <form onSubmit={handleLookup}>
                <div className="field">
                  <label htmlFor="student-id">รหัสนักเรียน</label>
                  <input
                    id="student-id"
                    type="text"
                    value={inputId}
                    onChange={(e) => setInputId(e.target.value)}
                    placeholder="กรอกรหัสนักเรียนของคุณ"
                    autoComplete="off"
                    autoFocus
                    required
                  />
                </div>
                {lookupError && <p className="error-text">{lookupError}</p>}
                <button
                  type="submit"
                  className="btn btn-marquee btn-full mt-1"
                  disabled={looking}
                >
                  {looking ? 'กำลังตรวจสอบ…' : 'เริ่มเช็คชื่อ →'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── QUIZ (countdown + question + answer) ── */}
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
              {/* Countdown */}
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>เวลาที่เหลือ</div>
                <div className={`timer${timeLeft <= 30 ? ' warn' : ''}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>

              {/* Question */}
              <div className="question-box">{week.question}</div>

              {/* Answer */}
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
                <button
                  type="submit"
                  className="btn btn-marquee btn-full"
                  disabled={submitting}
                >
                  {submitting ? 'กำลังบันทึก…' : 'ส่งคำตอบ & เช็คชื่อ ✓'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="ticket" style={{ textAlign: 'center' }}>
            <div
              className="ticket-stub"
              style={{ justifyContent: 'center', flexDirection: 'column', alignItems: 'center', padding: '1.5rem' }}
            >
              <span className="status-dot ok" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ok-green)', marginTop: '0.4rem' }}>
                เช็คชื่อสำเร็จ
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>
                {studentName}
              </p>
              <p className="mono" style={{ color: 'var(--ink-mid)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {studentId}
              </p>
              {doneRecord && (
                <p className="text-muted mt-2" style={{ fontSize: '0.82rem' }}>
                  บันทึกเมื่อ{' '}
                  {new Date(doneRecord.submitted_at).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                  {doneRecord.seconds_taken != null && ` · ใช้เวลา ${doneRecord.seconds_taken} วินาที`}
                </p>
              )}
              <p className="mt-3" style={{ color: 'var(--ink-mid)', fontSize: '0.9rem' }}>
                ขอบคุณ! คุณสามารถปิดหน้านี้ได้แล้ว
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
                เช็คชื่อแล้ว
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--ink)', fontWeight: 600 }}>
                คุณเช็คชื่อสัปดาห์นี้ไปแล้ว
              </p>
              <p className="text-muted mt-1" style={{ fontSize: '0.88rem' }}>
                ระบบบันทึกการเข้าเรียนของคุณไว้แล้ว ไม่สามารถเช็คชื่อซ้ำได้
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
