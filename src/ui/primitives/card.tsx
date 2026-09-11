import type { HTMLAttributes, ReactNode } from 'react';
export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) { return <div className={`rounded-2xl border border-[var(--barea-border)] bg-[var(--barea-surface)] shadow-sm ${className}`} {...props}>{children}</div>; }
export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) { return <div className={`border-b border-slate-100 px-5 py-4 sm:px-6 ${className}`} {...props}>{children}</div>; }
export function CardBody({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) { return <div className={`px-5 py-5 sm:px-6 ${className}`} {...props}>{children}</div>; }
