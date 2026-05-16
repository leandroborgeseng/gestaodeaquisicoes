import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

export const Icons = {
  Dashboard: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2" y="2" width="5" height="6" rx="1" /><rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="7" rx="1" /><rect x="2" y="10" width="5" height="4" rx="1" />
    </svg>
  ),
  Items: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 6.5h11M6 2.5v11" />
    </svg>
  ),
  Reports: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 13V8M7 13V4M11 13V10" /><path d="M2 13.5h12" />
    </svg>
  ),
  Suppliers: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M2 13.5V6l3-3h6l3 3v7.5" /><path d="M2 8h12M6 13.5v-3h4v3" />
    </svg>
  ),
  Users: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="6" cy="6" r="2.5" /><path d="M2 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <circle cx="11" cy="5.5" r="2" /><path d="M10.5 9.7c1.7.4 2.8 1.9 2.8 3.8" />
    </svg>
  ),
  Settings: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" />
    </svg>
  ),
  History: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M8 3.5a4.5 4.5 0 1 0 4.4 5.5" /><path d="M8 5v3l2 1" /><path d="M11 3v2.5h2.5" />
    </svg>
  ),
  Bell: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11z" /><path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  ),
  Search: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="7" cy="7" r="4" /><path d="m13 13-3-3" />
    </svg>
  ),
  Chevron: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="m6 4 4 4-4 4" />
    </svg>
  ),
  ChevDown: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="m4 6 4 4 4-4" />
    </svg>
  ),
  Plus: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  Filter: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M2 3.5h12L9.5 9v4l-3-1.5V9L2 3.5z" />
    </svg>
  ),
  Download: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M8 2v8M4.5 7l3.5 3 3.5-3M2.5 13.5h11" />
    </svg>
  ),
  Upload: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M8 11V3M4.5 6l3.5-3 3.5 3M2.5 13.5h11" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" {...p}>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  ),
  Alert: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M8 2.5 14.5 13.5h-13L8 2.5z" /><path d="M8 7v3M8 12v.5" />
    </svg>
  ),
  Doc: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3.5 2.5h6L12.5 5.5v8h-9v-11z" /><path d="M9.5 2.5v3h3" />
    </svg>
  ),
  Paper: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <path d="M5 5.5h6M5 8h6M5 10.5h4" />
    </svg>
  ),
  Spark: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="m8 2 1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z" />
    </svg>
  ),
  Eye: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  ),
  More: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
      <circle cx="4" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="12" cy="8" r="1.2" />
    </svg>
  ),
  Pin: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="8" cy="6" r="3" /><path d="M8 9v5" /><path d="M5 14h6" />
    </svg>
  ),
  Clip: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 4.5 5.5 9a2 2 0 0 0 2.8 2.8L13 7" />
    </svg>
  ),
  Logout: (p: IconProps) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10.5 11.5v2h-8v-11h8v2" /><path d="M6.5 8h8M12.5 6l2 2-2 2" />
    </svg>
  ),
};
