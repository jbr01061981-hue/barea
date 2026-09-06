import React from 'react';

export interface ReviewStatusBadgeProps {
  status: string;
  className?: string;
}

export function ReviewStatusBadge({ status, className = '' }: ReviewStatusBadgeProps) {
  const isPending = status === 'PENDING_REVIEW';
  const isApproved = status === 'APPROVED';
  const isDraft = status === 'DRAFT';
  const isArchived = status === 'ARCHIVED';

  let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-300';
  let label = status;

  if (isPending) {
    badgeClasses = 'bg-amber-50 text-amber-800 border-amber-300';
    label = 'Pending Review';
  } else if (isApproved) {
    badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    label = 'Approved';
  } else if (isDraft) {
    badgeClasses = 'bg-slate-100 text-slate-700 border-slate-300';
    label = 'Draft';
  } else if (isArchived) {
    badgeClasses = 'bg-red-50 text-red-700 border-red-200';
    label = 'Archived';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badgeClasses} ${className}`}
    >
      {label}
    </span>
  );
}