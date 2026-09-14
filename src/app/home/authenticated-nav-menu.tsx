'use client';

import { useState, useRef, useEffect } from 'react';
import { logoutAction } from '../login/actions';

interface AuthenticatedNavMenuProps {
  readonly displayName: string;
  readonly email: string | null;
  readonly isTeacherAuthorized: boolean;
}

export function AuthenticatedNavMenu({
  displayName,
  email,
  isTeacherAuthorized
}: AuthenticatedNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account navigation menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] text-white hover:border-[var(--barea-gold)] hover:bg-[#182337] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] active:bg-[#1e2a40] cursor-pointer"
      >
        <svg
          className="h-5 w-5 fill-current"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] py-2 shadow-2xl z-50 animate-in fade-in"
        >
          {/* Header info in menu */}
          <div className="px-4 py-2 border-b border-[var(--barea-slate-border)] text-xs">
            <p className="font-semibold text-white truncate">{displayName}</p>
            {email && <p className="text-[var(--barea-ivory-muted)] truncate">{email}</p>}
          </div>

          <div className="py-1">
            <a
              href="/home?workspace=individual"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex min-h-11 items-center px-4 text-sm font-medium text-white hover:bg-[var(--barea-paper-dark)] hover:text-[var(--barea-gold-light)] focus:bg-[var(--barea-paper-dark)] focus:outline-none"
            >
              Individual
            </a>
            {isTeacherAuthorized ? (
              <a
                href="/teacher/quizzes"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex min-h-11 items-center px-4 text-sm font-medium text-[var(--barea-gold)] hover:bg-[var(--barea-paper-dark)] hover:text-[var(--barea-gold-light)] focus:bg-[var(--barea-paper-dark)] focus:outline-none"
              >
                Create &amp; Host
              </a>
            ) : (
              <a
                href="/home?workspace=create-host"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex min-h-11 items-center justify-between px-4 text-sm font-medium text-[var(--barea-ivory-muted)] hover:bg-[var(--barea-paper-dark)] hover:text-white focus:bg-[var(--barea-paper-dark)] focus:outline-none"
              >
                <span>Create &amp; Host</span>
                <span aria-hidden="true" className="text-xs">🔒</span>
              </a>
            )}
          </div>

          <div className="border-t border-[var(--barea-slate-border)] pt-1">
            <form action={logoutAction} className="w-full">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full min-h-11 items-center px-4 text-left text-sm font-semibold text-red-300 hover:bg-[var(--barea-paper-dark)] hover:text-red-200 focus:bg-[var(--barea-paper-dark)] focus:outline-none cursor-pointer"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
