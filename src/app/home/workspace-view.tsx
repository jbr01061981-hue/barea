'use client';

import { useState } from 'react';
import { JoinRoomForm } from './join-room-form';

type IndividualSection = 'join' | 'assigned' | 'invited' | 'practice';

interface WorkspaceViewProps {
  readonly initialWorkspace: 'individual' | 'create-host';
  readonly displayName: string;
  readonly email: string | null;
  readonly isTeacherAuthorized: boolean;
}

export function WorkspaceView({
  initialWorkspace,
  displayName,
  email,
  isTeacherAuthorized
}: WorkspaceViewProps) {
  const [workspace, setWorkspace] = useState<'individual' | 'create-host'>(initialWorkspace);
  const [activeSection, setActiveSection] = useState<IndividualSection>('join');

  // Compute initials for fallback avatar
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="space-y-6">
      {/* Top Identity Block: BAREA Brand + User Identity */}
      <section
        aria-label="User profile and active workspace"
        className="rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-4 sm:p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Deterministic Avatar */}
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--barea-gold-muted)] bg-[var(--barea-paper-dark)] font-serif text-base font-bold text-[var(--barea-gold)] shadow-inner"
            >
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                  {displayName}
                </h1>
                {isTeacherAuthorized ? (
                  <span className="shrink-0 rounded-full border border-[var(--barea-gold-muted)] bg-[var(--barea-paper-dark)] px-2.5 py-0.5 text-[0.7rem] font-semibold text-[var(--barea-gold)]">
                    Host
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-[var(--barea-slate-border)] bg-[var(--barea-paper-dark)] px-2.5 py-0.5 text-[0.7rem] font-medium text-[var(--barea-ivory-muted)]">
                    Participant
                  </span>
                )}
              </div>
              {email && (
                <p className="text-xs text-[var(--barea-ivory-muted)] truncate mt-0.5">
                  {email}
                </p>
              )}
            </div>
          </div>

          {/* Workspace Switcher Tabs */}
          <div
            role="tablist"
            aria-label="Workspaces"
            className="flex items-center rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-paper-dark)] p-1 self-start sm:self-center"
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'individual'}
              onClick={() => setWorkspace('individual')}
              className={`min-h-9 rounded-[var(--barea-radius-control)] px-3.5 text-xs font-semibold transition-colors cursor-pointer ${
                workspace === 'individual'
                  ? 'bg-[var(--barea-gold)] text-[var(--barea-midnight)]'
                  : 'text-[var(--barea-ivory-muted)] hover:text-white'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'create-host'}
              onClick={() => {
                if (isTeacherAuthorized) {
                  window.location.href = '/teacher/quizzes';
                } else {
                  setWorkspace('create-host');
                }
              }}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-[var(--barea-radius-control)] px-3.5 text-xs font-semibold transition-colors cursor-pointer ${
                workspace === 'create-host'
                  ? 'bg-[var(--barea-gold)] text-[var(--barea-midnight)]'
                  : 'text-[var(--barea-ivory-muted)] hover:text-white'
              }`}
            >
              <span>Create &amp; Host</span>
              {!isTeacherAuthorized && <span aria-hidden="true">🔒</span>}
            </button>
          </div>
        </div>
      </section>

      {/* Workspace Content Display */}
      {workspace === 'create-host' ? (
        /* Create & Host Locked State (for Ordinary Participants) */
        <section
          aria-labelledby="locked-capability-title"
          className="rounded-[var(--barea-radius-card)] border border-amber-900/50 bg-[var(--barea-slate-card)] p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="text-xl">🔒</span>
            <h2 id="locked-capability-title" className="font-serif text-xl sm:text-2xl font-bold text-white">
              Create &amp; Host
            </h2>
          </div>

          <div className="space-y-2 max-w-xl text-xs sm:text-sm text-[var(--barea-ivory-muted)] leading-relaxed">
            <p className="font-medium text-amber-200/90">
              Host capability is currently unavailable for this account.
            </p>
            <p>
              Contact your church administrator to request host permissions.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setWorkspace('individual')}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-paper-dark)] px-5 text-sm font-semibold text-white transition-colors hover:border-[var(--barea-gold)] hover:bg-[#182337] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] cursor-pointer"
            >
              ← Return to Individual
            </button>
          </div>
        </section>
      ) : (
        /* Individual Workspace */
        <section aria-label="Individual Workspace" className="space-y-6">
          {/* Individual Section Sub-navigation */}
          <div className="border-b border-[var(--barea-slate-border)] pb-2 overflow-x-auto">
            <nav
              role="tablist"
              aria-label="Individual workspace sections"
              className="flex items-center gap-2 min-w-max"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'join'}
                onClick={() => setActiveSection('join')}
                className={`flex min-h-11 items-center gap-2 rounded-[var(--barea-radius-control)] px-4 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  activeSection === 'join'
                    ? 'border border-[var(--barea-gold)] bg-[var(--barea-slate-card)] text-white shadow-sm'
                    : 'text-[var(--barea-ivory-muted)] hover:text-white hover:bg-[var(--barea-slate-card)]/50'
                }`}
              >
                <span>🎯</span>
                <span>Join a Quiz</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'assigned'}
                onClick={() => setActiveSection('assigned')}
                className={`flex min-h-11 items-center gap-2 rounded-[var(--barea-radius-control)] px-4 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  activeSection === 'assigned'
                    ? 'border border-[var(--barea-gold)] bg-[var(--barea-slate-card)] text-white shadow-sm'
                    : 'text-[var(--barea-ivory-muted)] hover:text-white hover:bg-[var(--barea-slate-card)]/50'
                }`}
              >
                <span>📋</span>
                <span>Assigned Quizzes</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'invited'}
                onClick={() => setActiveSection('invited')}
                className={`flex min-h-11 items-center gap-2 rounded-[var(--barea-radius-control)] px-4 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  activeSection === 'invited'
                    ? 'border border-[var(--barea-gold)] bg-[var(--barea-slate-card)] text-white shadow-sm'
                    : 'text-[var(--barea-ivory-muted)] hover:text-white hover:bg-[var(--barea-slate-card)]/50'
                }`}
              >
                <span>✉</span>
                <span>Invited Quizzes</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSection === 'practice'}
                onClick={() => setActiveSection('practice')}
                className={`flex min-h-11 items-center gap-2 rounded-[var(--barea-radius-control)] px-4 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  activeSection === 'practice'
                    ? 'border border-[var(--barea-gold)] bg-[var(--barea-slate-card)] text-white shadow-sm'
                    : 'text-[var(--barea-ivory-muted)] hover:text-white hover:bg-[var(--barea-slate-card)]/50'
                }`}
              >
                <span>📖</span>
                <span>Practice &amp; Open Quizzes</span>
              </button>
            </nav>
          </div>

          {/* Section 1: Join a Quiz */}
          {activeSection === 'join' && (
            <div
              role="tabpanel"
              aria-labelledby="join-quiz-title"
              className="rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden="true">🎯</span>
                  <h2 id="join-quiz-title" className="font-serif text-lg sm:text-xl font-bold text-white">
                    Join a Quiz
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-[var(--barea-ivory-muted)] leading-relaxed">
                  Enter a room code shared by your church teacher or host to participate with your congregation.
                </p>
              </div>

              <div className="pt-2 max-w-md">
                <JoinRoomForm />
              </div>
            </div>
          )}

          {/* Section 2: Assigned Quizzes */}
          {activeSection === 'assigned' && (
            <div
              role="tabpanel"
              aria-labelledby="assigned-quizzes-title"
              className="rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--barea-slate-border)]">
                <div>
                  <h2 id="assigned-quizzes-title" className="font-serif text-lg font-bold text-white">
                    Assigned Quizzes
                  </h2>
                  <p className="text-xs text-[var(--barea-ivory-muted)]">
                    Quizzes specifically assigned to your class or individual profile.
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--barea-ivory-muted)]">0 Active</span>
              </div>

              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-[var(--barea-ivory)]">
                  No active quiz assignments at this time.
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Assigned quizzes will appear here when assigned by your church curriculum.
                </p>
              </div>
            </div>
          )}

          {/* Section 3: Invited Quizzes */}
          {activeSection === 'invited' && (
            <div
              role="tabpanel"
              aria-labelledby="invited-quizzes-title"
              className="rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--barea-slate-border)]">
                <div>
                  <h2 id="invited-quizzes-title" className="font-serif text-lg font-bold text-white">
                    Invited Quizzes
                  </h2>
                  <p className="text-xs text-[var(--barea-ivory-muted)]">
                    Scheduled live sessions or fellowship events you have been invited to by email or phone.
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--barea-ivory-muted)]">0 Invitations</span>
              </div>

              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-[var(--barea-ivory)]">
                  No pending quiz invitations found.
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  When a host invites your verified contact details to a session, it will appear here.
                </p>
              </div>
            </div>
          )}

          {/* Section 4: Practice & Open Quizzes */}
          {activeSection === 'practice' && (
            <div
              role="tabpanel"
              aria-labelledby="practice-quizzes-title"
              className="rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-5 sm:p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--barea-slate-border)]">
                <div>
                  <h2 id="practice-quizzes-title" className="font-serif text-lg font-bold text-white">
                    Practice &amp; Open Quizzes
                  </h2>
                  <p className="text-xs text-[var(--barea-ivory-muted)]">
                    Self-paced Scripture learning and open fellowship quizzes.
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--barea-ivory-muted)]">Catalog</span>
              </div>

              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-[var(--barea-ivory)]">
                  Practice catalog is currently being prepared by church curators.
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Self-paced solo practice and public study banks will be unlocked in an upcoming release.
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
