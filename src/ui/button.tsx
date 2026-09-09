import React from 'react';
import {
  Button as AriaButton,
  ButtonProps as AriaButtonProps,
} from 'react-aria-components';

export interface BareaButtonProps extends AriaButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: BareaButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-colors cursor-pointer rounded border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[44px]',
    lg: 'px-5 py-2.5 text-base min-h-[48px]',
  }[size];

  const variantClasses = {
    primary:
      'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 active:bg-slate-950',
    secondary:
      'bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200 active:bg-slate-300',
    outline:
      'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 active:bg-slate-100',
    danger:
      'bg-white text-red-700 border-red-300 hover:bg-red-50 active:bg-red-100 focus-visible:ring-red-600',
  }[variant];

  return (
    <AriaButton
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </AriaButton>
  );
}