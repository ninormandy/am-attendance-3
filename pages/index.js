import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const CHECKIN_SECONDS = 300; // 5-minute quiz window

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CheckInPage() {
  // step: 'loading' | 'closed' | 'capture' | 'entry' | 'quiz' | 'done' | 'already'
  const [step, setStep] = useState('loading');
  const [week, setWeek] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);

  // Capture step states
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Entry step states
  const [inputId, setInputId] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);

  // Quiz step states
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(CHECKIN_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Done step state
  const [doneRecord, setDoneRecord] = useState(null);

  const answerRef = useRef('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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

  // Detect Device Environment and Load Week Data
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const hasTouchCapabilities = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Set desktop flag if mobile layout signals are absent
    if (!isMobileDevice && !hasTouchCapabilities) {
      setIsDesktop(true);
    }

    fetch('/api/attendance/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.open) {
          setWeek(data.week);
          const deviceLock = localStorage.getItem(`submitted_week_${data.week.id}`);
          if (deviceLock) {
            setStep('already');
          } else {
            setStep('capture');
          }
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

  // Clean up WebRTC hardware streams if component unmounts
  useEffect(() => {
    return () => stopWebcamStream();
  }, []);

  // WebRTC Stream Controllers
  async function startWebcamStream() {
    setPhotoPreview(null);
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      alert('ไม่สามารถเข้าถึงกล้องเว็บแคมได้ กรุณาอนุญาตให้ระบบเข้าถึงกล้องถ่ายภาพของคุณ');
    }
  }

  function stopWebcamStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function captureWebcamSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Create an offscreen dynamic canvas rendering context
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert current pixel mapping to raw image blob structure
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      stopWebcamStream();
    }, 'image/jpeg', 0.85);
  }

  // Handle Standard Mobile Native Capture
  const handleMobilePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhotoAndRetake = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (isDesktop) {
      startWebcamStream();
    }
  };

  const handleConfirmPhoto = (e) => {
    e.preventDefault();
    if (!photo) return alert('กรุณาถ่ายรูปภาพหลักฐานก่อนเข้าหน้าถัดไป');
    setStep('entry'); 
  };

  // Handle Student ID Lookup
  async function handleLookup(e) {
    e.preventDefault();
    setLookupError('');
    setLooking(true);

    const deviceLock = localStorage.getItem(`submitted_week_${week.id}`);
    if (deviceLock) {
      setStep('already');
      setLooking(false);
      return;
    }

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

  // Final Multipart Form Submission
  async function submitAnswer(secondsUsedOverride, answerOverride) {
    if (submitting) return;
    setSubmitting(true);
    
    const secondsTaken =
      secondsUsedOverride != null
        ? CHECKIN_SECONDS - secondsUsedOverride
        : CHECKIN_SECONDS - timeLeft;

    const fingerprint = getDeviceFingerprint();

    const formData = new FormData();
    formData.append('week_id', week.id);
    formData.append('student_id', studentId);
    formData.append('answer', answerOverride !== undefined ? answerOverride : answer);
    formData.append('seconds_taken', secondsTaken);
    formData.append('photo', photo);
    formData.append('fingerprint', fingerprint);

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (res.status === 409 || data.error?.includes('เช็คชื่อไปแล้ว')) {
        localStorage.setItem(`submitted_week_${week.id}`, 'true');
        setStep('already');
      } else if (res.status === 403) {
        setSubmitError('การเช็คชื่อถูกปิดแล้ว กรุณาติดต่ออาจารย์บอล');
        setStep('closed');
      } else if (!res.ok) {
        setSubmitError(data.error || 'ส่งไม่สำเร็จ กรุณาลองใหม่');
        setSubmitting(false);
      } else {
        localStorage.setItem(`submitted_week_${week.id}`, 'true');
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
                ไม่มีการเช็คชื่อที่เปิดอยู่ในขณะนี้
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--ink-mid)', fontSize: '0.9rem' }}>
                กรุณารอจนกว่าอาจารย์บอลจะเปิดการเช็คชื่อ แล้วรีเฟรชหน้านี้
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 1: CAMERA PROOF CAPTURE ── */}
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
                  ขั้นตอนที่ 1: ถ่ายภาพตนเองกับบรรยากาศภายในห้องเรียน โดยต้องถ่ายติดอาจารย์บอลเท่านั้น จึงจะเช็คชื่อผ่าน
                </div>
                <div className="stub-meta">ต้องถ่ายรูปภาพเพื่อทำควิซ</div>
              </div>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ textAlign: 'center' }}>
              
              {/* DESKTOP PC INTERFACE ROUTE (WebRTC Camera, No File Upload Allowed) */}
              {isDesktop && (
                <div>
                  {!cameraActive && !photoPreview && (
                    <div style={{ padding: '1.5rem 0' }}>
                      <p style={{ marginBottom: '1.5rem', color: 'var(--ink-mid)' }}>
                        ระบบตรวจพบการใช้งานผ่านคอมพิวเตอร์ กรุณากดปุ่มเปิดกล้องเว็บแคมเพื่อถ่ายภาพสดหน้าชั้นเรียน (ห้ามอัปโหลดรูปภาพ)
                      </p>
                      <button type="button" className="btn btn-marquee btn-full" onClick={startWebcamStream}>
                        📷 เปิดกล้องเว็บแคมเครื่อง PC
                      </button>
                    </div>
                  )}

                  {cameraActive && (
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '6px', backgroundColor: '#000', maxWidth: '100%', width: '480px', margin: '0 auto' }}>
                      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                      <button type="button" className="btn btn-marquee" onClick={captureWebcamSnapshot} style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                        📸 กดถ่ายรูปภาพ (Take Photo)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MOBILE PHONE INTERFACE ROUTE (Locked Native Capture) */}
              {!isDesktop && !photoPreview && (
                <div style={{ padding: '1.5rem 0' }}>
                  <p style={{ marginBottom: '1.5rem', color: 'var(--ink-mid)' }}>
                    กรุณากดปุ่มด้านล่างเพื่อเปิดกล้อง และถ่ายภาพเซลฟี่ให้เห็นอาจารย์บอลเพื่อเป็นหลักฐานการเข้าเรียน
                  </p>
                  <label className="btn btn-marquee btn-full" style={{ display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                    📷 เปิดกล้องถ่ายภาพ
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleMobilePhotoCapture} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              )}

              {/* CONFIRMATION OVERLAY PREVIEW VIEW (Shared across both flows) */}
              {photoPreview && (
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
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>{studentName}</p>
              <p className="mono" style={{ color: 'var(--ink-mid)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{studentId}</p>
              <p className="mt-3" style={{ color: 'var(--ink-mid)', fontSize: '0.9rem' }}>
                ระบบได้แนบภาพถ่ายหลักฐานของคุณส่งให้อาจารย์บอลเรียบร้อยแล้ว สามารถปิดหน้านี้ได้เลยครับ
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
                อุปกรณ์นี้เคยเช็คชื่อไปแล้ว
              </span>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-body" style={{ padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--ink)', fontWeight: 600 }}>ล้มเหลว: ตรวจพบข้อมูลการส่งซ้ำ</p>
              <p className="text-muted mt-1" style={{ fontSize: '0.88rem' }}>
                อุปกรณ์นี้ได้ส่งภาพหลักฐานการเช็คชื่อเข้าเรียนในสัปดาห์นี้ไปแล้ว ไม่สามารถส่งซ้ำได้ครับ
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}