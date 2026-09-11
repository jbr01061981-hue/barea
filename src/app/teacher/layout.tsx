import type { ReactNode } from 'react';
import { TeacherShell } from '../../ui/layout/app-shell';

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
