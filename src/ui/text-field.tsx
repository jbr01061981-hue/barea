import React from 'react';
import {
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
  Label as AriaLabel,
  Input as AriaInput,
  TextArea as AriaTextArea,
  FieldError as AriaFieldError,
  Text as AriaText,
} from 'react-aria-components';

export interface BareaTextFieldProps extends AriaTextFieldProps {
  label: string;
  description?: string;
  errorMessage?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

export function TextField({
  label,
  description,
  errorMessage,
  multiline = false,
  rows = 3,
  className = '',
  ...props
}: BareaTextFieldProps) {
  const inputClasses =
    'w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors disabled:bg-slate-100 disabled:text-slate-500';

  return (
    <AriaTextField className={`flex flex-col gap-1.5 ${className}`} {...props}>
      <AriaLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
        {label}
      </AriaLabel>
      {multiline ? (
        <AriaTextArea rows={rows} className={`${inputClasses} resize-y min-h-[72px]`} />
      ) : (
        <AriaInput className={`${inputClasses} min-h-[40px]`} />
      )}
      {description && (
        <AriaText slot="description" className="text-xs text-slate-500">
          {description}
        </AriaText>
      )}
      <AriaFieldError className="text-xs font-medium text-red-600">
        {errorMessage}
      </AriaFieldError>
    </AriaTextField>
  );
}