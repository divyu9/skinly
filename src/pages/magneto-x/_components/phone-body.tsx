/**
 * A phone to snap the disc onto. Drawn, not photographed, for the same reason
 * the disc is: it has to be seen from the back at an angle the studio stills
 * never cover, and it has to not be a specific handset — this thing fits any
 * MagSafe-compatible phone, and showing one model implies it doesn't.
 */
export function PhoneBody({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 400" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mx-phone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d4a63" />
          <stop offset="45%" stopColor="#243044" />
          <stop offset="100%" stopColor="#161f2e" />
        </linearGradient>
        <linearGradient id="mx-phone-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8c99b0" />
          <stop offset="12%" stopColor="#2b364a" />
          <stop offset="50%" stopColor="#39465c" />
          <stop offset="100%" stopColor="#7f8ca3" />
        </linearGradient>
        <radialGradient id="mx-lens" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#4a586f" />
          <stop offset="100%" stopColor="#0a0e15" />
        </radialGradient>
      </defs>

      <rect x="6" y="6" width="188" height="388" rx="34" fill="url(#mx-phone-edge)" />
      <rect x="10" y="10" width="180" height="380" rx="31" fill="url(#mx-phone)" />

      {/* Camera island */}
      <rect x="26" y="26" width="86" height="86" rx="26" fill="#1b2433" stroke="#46536b" strokeWidth="1.2" />
      {[
        [54, 54],
        [86, 54],
        [54, 86],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="14" fill="#0d131c" />
          <circle cx={cx} cy={cy} r="14" fill="none" stroke="#5c6a82" strokeWidth="1.6" />
          <circle cx={cx} cy={cy} r="7" fill="url(#mx-lens)" />
          <circle cx={cx - 3} cy={cy - 4} r="2.4" fill="#9fb4d6" opacity="0.5" />
        </g>
      ))}
      <circle cx="88" cy="88" r="6" fill="#26303f" />
    </svg>
  );
}
