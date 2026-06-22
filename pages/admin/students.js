import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminShell from '../../components/AdminShell';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state — shared for create and edit
  const [editingId, setEditingId] = useState(null);  // null = create mode
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function fetchStudents() {
    const res = await fetch('/api/students');
    if (res.ok) {
      const data = await res.json();
      setStudents(data.students);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  function openCreate() {
    setEditingId(null);
    setStudentId('');
    setName('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(student) {
    setEditingId(student.id);
    setStudentId(student.student_id);
    setName(student.name);
    setFormError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setStudentId('');
    setName('');
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const url = editingId ? `/api/students/${editingId}` : '/api/students';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'บันทึกไม่สำเร็จ');
      } else {
        cancelForm();
        fetchStudents();
      }
    } catch {
      setFormError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(student) {
    if (!confirm(`ลบ "${student.name}" (${student.student_id}) ออกจากระบบ?`)) return;
    await fetch(`/api/students/${student.id}`, { method: 'DELETE' });
    fetchStudents();
  }

  return (
    <>
      <Head><title>จัดการนักเรียน — AM Attendance</title></Head>
      <AdminShell>
        <div className="toolbar">
          <h1 className="toolbar-title">จัดการนักเรียน</h1>
          {!showForm && (
            <button className="btn btn-marquee" onClick={openCreate}>
              + เพิ่มนักเรียน
            </button>
          )}
        </div>

        {showForm && (
          <div className="card" style={{ maxWidth: 520, marginBottom: '2rem' }}>
            <div className="card-title">
              {editingId ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}
            </div>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="sid">รหัสนักเรียน</label>
                <input
                  id="sid"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="เช่น 6701"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="sname">ชื่อ-นามสกุล</label>
                <input
                  id="sname"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อ นามสกุล"
                  required
                />
              </div>
              {formError && <p className="error-text">{formError}</p>}
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-marquee" disabled={saving}>
                  {saving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-muted">กำลังโหลด…</p>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem' }}>🎭</div>
            <p>ยังไม่มีนักเรียนในระบบ</p>
            <p>กดปุ่ม "เพิ่มนักเรียน" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>รหัสนักเรียน</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>เพิ่มเมื่อ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.student_id}</td>
                    <td>{s.name}</td>
                    <td className="mono text-muted">
                      {new Date(s.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(s)}
                        style={{ marginRight: '0.4rem' }}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(s)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {students.length > 0 && (
          <p className="text-muted mt-2">
            นักเรียนทั้งหมด {students.length} คน
          </p>
        )}
      </AdminShell>
    </>
  );
}
