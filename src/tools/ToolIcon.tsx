import type { ReactNode } from 'react';

/** Shared frame for 20 × 20 line icons drawn on a 24-unit grid. */
export const ToolIcon = ({ children }: { children: ReactNode }) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);
