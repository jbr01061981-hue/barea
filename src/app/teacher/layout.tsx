import './teacher-workspace.css';
import { ensureAuthorizedTeacherPage } from './auth-guard';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await ensureAuthorizedTeacherPage('/teacher/quizzes');

  return (
    <div className="teacher-workspace-shell">
      <aside className="teacher-workspace-sidebar" aria-label="Teacher workspace navigation">
        <a href="/teacher/quizzes" className="teacher-workspace-wordmark">BAREA</a>
        <p className="teacher-workspace-eyebrow">TEACHER WORKSPACE</p>
        <nav>
          <a className="teacher-workspace-nav-active" href="/teacher/quizzes">Quiz Library</a>
          <a href="/teacher/review">Question Review</a>
        </nav>
        <div className="teacher-workspace-sidebar-footer">
          <span>org_berea_central</span>
          <a href="/">Public site</a>
        </div>
      </aside>
      <div className="teacher-workspace-content">{children}</div>
    </div>
  );
}
