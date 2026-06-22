import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
      } else {
        router.push('/admin/dashboard');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>เข้าสู่ระบบ — AM Attendance</title>
      </Head>
      <div className="center-screen">
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="brand">AM ATTENDANCE</div>
            <div className="brand-sub">ระบบเช็คชื่อนักเรียน</div>
          </div>

          <div className="card">
            <h2 className="card-title">เข้าสู่ระบบผู้ดูแล</h2>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="username">ชื่อผู้ใช้</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="password">รหัสผ่าน</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && <p className="error-text">{error}</p>}

              <button
                type="submit"
                className="btn btn-marquee btn-full mt-2"
                disabled={loading}
              >
                {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
