'use client';

export default function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="flex-shrink-0"
    >
      <circle cx="32" cy="32" r="30" fill="#1A3D1F" stroke="#4A8C3F" strokeWidth="1"/>
      {/* Body */}
      <ellipse cx="32" cy="38" rx="8" ry="14" fill="#F4607A"/>
      {/* Head */}
      <circle cx="32" cy="22" r="6" fill="#F4849A"/>
      <ellipse cx="32" cy="21" rx="5" ry="4.5" fill="#F4607A"/>
      {/* Hair/crest */}
      <path d="M30 16 Q32 12 34 16" stroke="#F4607A" strokeWidth="2" fill="none"/>
      <path d="M31 17 Q32 11 33 17" stroke="#F4849A" strokeWidth="1.5" fill="none"/>
      {/* Sunglasses */}
      <rect x="27.5" y="19" width="9" height="3" rx="1.5" fill="#333" opacity="0.85"/>
      <line x1="26.5" y1="20.5" x2="24" y2="18.5" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="37.5" y1="20.5" x2="40" y2="18.5" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Beak */}
      <path d="M30 24 Q32 26 34 24" stroke="#8B5E3C" strokeWidth="1.2" fill="#8B5E3C"/>
      {/* Legs */}
      <line x1="30" y1="52" x2="30" y2="47" stroke="#F4849A" strokeWidth="1.5"/>
      <line x1="34" y1="52" x2="34" y2="47" stroke="#F4849A" strokeWidth="1.5"/>
      {/* Leaves */}
      <path d="M15 32 Q8 22 16 14" stroke="#4A8C3F" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M12 36 Q6 28 12 20" stroke="#4A8C3F" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M49 32 Q56 22 48 14" stroke="#4A8C3F" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M52 36 Q58 28 52 20" stroke="#4A8C3F" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* Sign */}
      <rect x="42" y="28" width="2" height="18" fill="#8B5E3C" rx="0.5"/>
      <rect x="38" y="26" width="14" height="8" rx="1" fill="#8B5E3C"/>
      <text x="45" y="32" textAnchor="middle" fill="#1A3D1F" fontSize="3" fontFamily="sans-serif" fontWeight="bold">JL</text>
    </svg>
  );
}
