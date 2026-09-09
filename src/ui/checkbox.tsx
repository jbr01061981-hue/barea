import React from 'react';
import {
  Checkbox as AriaCheckbox,
  CheckboxProps as AriaCheckboxProps,
} from 'react-aria-components';

export interface BareaCheckboxProps extends AriaCheckboxProps {
  label?: React.ReactNode;
  className?: string;
}

export function Checkbox({ label, className = '', ...props }: BareaCheckboxProps) {
  return (
    <AriaCheckbox
      className={`group flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800 focus:outline-none min-h-[24px] ${className}`}
      {...props}
    >
      {({ isSelected, isIndeterminate, isFocused }) => (
        <>
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              isSelected || isIndeterminate
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-300 group-hover:border-slate-400'
            } ${isFocused ? 'ring-2 ring-offset-1 ring-slate-900' : ''}`}
          >
            {isSelected && (
              <svg
                className="w-3.5 h-3.5 fill-current"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                />
              </svg>
            )}
            {isIndeterminate && (
              <div className="w-2.5 h-0.5 bg-white rounded-full" />
            )}
          </div>
          {label && <span>{label}</span>}
        </>
      )}
    </AriaCheckbox>
  );
}