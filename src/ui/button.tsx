import React from 'react';
import { Button as AriaButton, ButtonProps as AriaButtonProps } from 'react-aria-components';

export interface BareaButtonProps extends AriaButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: BareaButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const sizeClasses = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-4 text-sm', lg: 'min-h-12 px-5 text-base' }[size];
  const variantClasses = {
    primary: 'border-[var(--barea-primary)] bg-[var(--barea-primary)] text-white hover:bg-[var(--barea-primary-hover)] active:bg-slate-950',
    secondary: 'border-transparent bg-[var(--barea-surface-muted)] text-slate-900 hover:bg-slate-200 active:bg-slate-300',
    outline: 'border-[var(--barea-border-strong)] bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100',
    danger: 'border-red-200 bg-white text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:ring-red-600',
  }[variant];
  return <AriaButton className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`} {...props}>{children}</AriaButton>;
}
