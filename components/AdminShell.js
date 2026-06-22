import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AdminShell({ children, title }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  function isActive(href) {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <span className="shell-brand">AM ATTENDANCE</span>

        <nav className="nav-links">
          <Link
            href="/admin/dashboard"
            className={`nav-link${isActive('/admin/dashboard') || isActive('/admin/week') ? ' active' : ''}`}
          >
            สัปดาห์
          </Link>
          <Link
            href="/admin/students"
            className={`nav-link${isActive('/admin/students') ? ' active' : ''}`}
          >
            นักเรียน
          </Link>
        </nav>

        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          ออกจากระบบ
        </button>
      </header>

      <main className="shell-main">
        {title && (
          <div className="toolbar">
            <h1 className="toolbar-title">{title}</h1>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
