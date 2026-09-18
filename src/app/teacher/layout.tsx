import './teacher-workspace.css';
import { logoutAction } from '../login/actions';
import { HistoryBfcacheGuard } from '../history-bfcache-guard';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-barea-auth-shell="" className="teacher-workspace-shell">
      <HistoryBfcacheGuard />

      <aside className="teacher-workspace-sidebar" aria-label="Teacher workspace navigation">
        <a href="/teacher" className="teacher-workspace-wordmark">BAREA</a>
        <p className="teacher-workspace-eyebrow">TEACHER WORKSPACE</p>
        <nav>
          <a className="teacher-workspace-nav-active" href="/teacher">Workspace</a>
          <a href="/teacher/quizzes">Quiz Library</a>
          <a href="/teacher/review">Question Review</a>
        </nav>
        <div className="teacher-workspace-sidebar-footer">
          <span>org_berea_central</span>
          <a href="/home">Home</a>
          <a href="/">Public preview</a>
          <form action={logoutAction} className="mt-1">
            <button
              type="submit"
              className="flex w-full min-h-11 items-center px-3 text-left text-[0.82rem] font-semibold text-[#536274] hover:bg-[#f1f0eb] hover:text-[#14243a] rounded-[4px] border border-transparent transition-colors cursor-pointer"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="teacher-workspace-content">{children}</div>
    </div>
  );
}
