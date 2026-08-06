import React from 'react';

type P = { size?: number };
const S = ({ size = 16, children, viewBox = '0 0 24 24' }: P & { children: React.ReactNode; viewBox?: string }) => (
  <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export const IconUndo = (p: P) => <S {...p}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></S>;
export const IconFlag = (p: P) => <S {...p}><path d="M4 22V4" /><path d="M4 4c3-2 6 2 10 0v9c-4 2-7-2-10 0" /></S>;
export const IconSwords = (p: P) => <S {...p}><path d="M3 3l8 8" /><path d="M13.5 13.5L21 21" /><path d="M21 3l-8 8" /><path d="M10.5 13.5L3 21" /><path d="M14 21l7-7" /><path d="M3 14l7 7" /></S>;
export const IconSound = (p: P) => <S {...p}><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></S>;
export const IconMute = (p: P) => <S {...p}><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M22 9l-6 6" /><path d="M16 9l6 6" /></S>;
export const IconExpand = (p: P) => <S {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></S>;
export const IconFlip = (p: P) => <S {...p}><path d="M16 3l4 4-4 4" /><path d="M20 7H8" /><path d="M8 21l-4-4 4-4" /><path d="M4 17h12" /></S>;
export const IconGrid = (p: P) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></S>;
export const IconGear = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" /></S>;
export const IconCpu = (p: P) => <S {...p}><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></S>;
export const IconUsers = (p: P) => <S {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></S>;
export const IconEye = (p: P) => <S {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></S>;
export const IconCrown = (p: P) => <S {...p}><path d="M2 8l5 4 5-8 5 8 5-4v10H2z" /></S>;
export const IconHourglass = (p: P) => <S {...p}><path d="M6 2h12" /><path d="M6 22h12" /><path d="M7 2v4l5 6 5-6V2" /><path d="M7 22v-4l5-6 5 6v4" /></S>;
export const IconClose = (p: P) => <S {...p}><path d="M18 6L6 18" /><path d="M6 6l12 12" /></S>;
export const IconHome = (p: P) => <S {...p}><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></S>;
export const IconPlay = (p: P) => <S {...p}><path d="M6 4l14 8-14 8V4z" /></S>;
export const IconBook = (p: P) => <S {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></S>;
