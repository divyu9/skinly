/**
 * The Magneto X itself, drawn rather than photographed.
 *
 * The product shots we hold are three-quarter studio stills on white — fine on
 * a product page, useless for a page that has to turn the thing over as you
 * scroll. So the disc is rebuilt as vector geometry taken off those stills:
 * the recessed top plate, the four hex screws on their 45° circle, the engraved
 * MAGNETO X wordmark, the PD/100W stamp with its ▲, the notch at four o'clock,
 * and the USB-C mouth on the rim. It can then be lit, tilted and taken apart at
 * any angle without a render farm.
 */

interface DiscProps {
  /** Which face is toward the viewer. The back shows the board. */
  face?: "top" | "bottom";
  className?: string;
}

const SCREWS: Array<[number, number]> = [
  [88, 88],
  [168, 88],
  [88, 168],
  [168, 168],
];

export function MagnetoDisc({ face = "top", className }: DiscProps) {
  return (
    <svg viewBox="0 0 256 256" className={className} aria-hidden="true">
      <defs>
        {/* Anodised aluminium: a cool sweep with a hot band where the bevel
            catches the key light, not a flat grey. */}
        <linearGradient id="mx-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f6f8" />
          <stop offset="22%" stopColor="#b9c0c7" />
          <stop offset="46%" stopColor="#eef1f4" />
          <stop offset="68%" stopColor="#98a1a9" />
          <stop offset="100%" stopColor="#d8dde2" />
        </linearGradient>

        <radialGradient id="mx-plate" cx="36%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#fbfcfd" />
          <stop offset="55%" stopColor="#dfe4e9" />
          <stop offset="100%" stopColor="#b6bec6" />
        </radialGradient>

        <linearGradient id="mx-groove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8f979f" />
          <stop offset="100%" stopColor="#e7ebee" />
        </linearGradient>

        <radialGradient id="mx-board" cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#26303a" />
          <stop offset="100%" stopColor="#11171d" />
        </radialGradient>

        <linearGradient id="mx-screw" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2f4f6" />
          <stop offset="100%" stopColor="#9aa3ab" />
        </linearGradient>

        {/* The specular streak that sells metal. Swept by the scroll. */}
        <linearGradient id="mx-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <clipPath id="mx-clip">
          <circle cx="128" cy="128" r="120" />
        </clipPath>
      </defs>

      {/* Outer body */}
      <circle cx="128" cy="128" r="120" fill="url(#mx-rim)" />
      <circle cx="128" cy="128" r="120" fill="none" stroke="#7d868e" strokeWidth="1.5" opacity="0.55" />

      {/* The bite out of the rim, so the disc reads as machined rather than
          as a plain circle — it is the cable relief on the real part. */}
      <path
        d="M242 150 a 118 118 0 0 1 -6 18 l -14 -6 a 102 102 0 0 0 5 -15 z"
        fill="#a8b0b8"
        opacity="0.75"
      />

      {face === "top" ? (
        <>
          <circle cx="128" cy="128" r="106" fill="url(#mx-groove)" opacity="0.5" />
          <circle cx="128" cy="128" r="103" fill="url(#mx-plate)" />
          <circle cx="128" cy="128" r="103" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.7" />
          <circle cx="128" cy="128" r="94" fill="none" stroke="#aab2ba" strokeWidth="0.9" opacity="0.6" />

          {SCREWS.map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="7.5" fill="url(#mx-screw)" />
              <circle cx={cx} cy={cy} r="7.5" fill="none" stroke="#8b949c" strokeWidth="0.8" />
              <path
                d={`M${cx - 3.4} ${cy - 2} h6.8 M${cx - 3.4} ${cy + 2} h6.8`}
                stroke="#8b949c"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Engraved, not printed: a light edge above a dark one is what makes
              lettering look cut into metal. */}
          <g>
            <text
              x="128"
              y="136"
              textAnchor="middle"
              fontSize="25"
              fontWeight="800"
              letterSpacing="1.6"
              fill="#ffffff"
              opacity="0.85"
              fontFamily="Inter, system-ui, sans-serif"
            >
              MAGNETO<tspan fontSize="31" dy="1">X</tspan>
            </text>
            <text
              x="128"
              y="134.6"
              textAnchor="middle"
              fontSize="25"
              fontWeight="800"
              letterSpacing="1.6"
              fill="#7f8891"
              opacity="0.55"
              fontFamily="Inter, system-ui, sans-serif"
            >
              MAGNETO<tspan fontSize="31" dy="1">X</tspan>
            </text>
          </g>

          <g transform="rotate(-90 62 128)">
            <text
              x="62"
              y="131"
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              letterSpacing="0.8"
              fill="#8d959d"
              fontFamily="Inter, system-ui, sans-serif"
            >
              PD/100W
            </text>
          </g>
          <path d="M52 106 l4.5 7 h-9 z" fill="#8d959d" />
        </>
      ) : (
        <>
          {/* The board side, from the teardown still: NVMe slot across the
              middle, USB-C at top, the QC PASSED disc, and the component
              clusters that make it read as populated rather than empty. */}
          <circle cx="128" cy="128" r="104" fill="url(#mx-board)" />
          <circle cx="128" cy="128" r="104" fill="none" stroke="#39434d" strokeWidth="1" />
          <g clipPath="url(#mx-clip)">
            <rect x="58" y="118" width="140" height="20" rx="3" fill="#0b0f13" />
            <rect x="58" y="118" width="140" height="20" rx="3" fill="none" stroke="#4b93d6" strokeWidth="1.4" />
            {Array.from({ length: 26 }).map((_, i) => (
              <rect key={i} x={64 + i * 5} y={121} width="2.2" height="6" rx="1" fill="#c9a227" />
            ))}
            <rect x="104" y="52" width="48" height="26" rx="7" fill="#151b21" stroke="#6d7780" strokeWidth="1.4" />
            <rect x="112" y="60" width="32" height="10" rx="5" fill="#0a0d10" />
            <rect x="108" y="182" width="40" height="22" rx="6" fill="#151b21" stroke="#6d7780" strokeWidth="1.3" />
            <circle cx="86" cy="164" r="15" fill="#f4f2e8" opacity="0.9" />
            <text x="86" y="162" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#3b4249" fontFamily="Inter, sans-serif">QC</text>
            <text x="86" y="170" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#3b4249" fontFamily="Inter, sans-serif">PASSED</text>
            <rect x="54" y="86" width="26" height="16" rx="2" fill="#2c353e" />
            <rect x="174" y="88" width="20" height="13" rx="2" fill="#2c353e" />
            <rect x="168" y="152" width="24" height="15" rx="2" fill="#2c353e" />
            <circle cx="176" cy="182" r="6" fill="#b08d3a" />
            {SCREWS.map(([cx, cy]) => (
              <circle key={`b-${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="#e6eaee" opacity="0.85" />
            ))}
          </g>
        </>
      )}

      {/* Moving highlight. Parent sets --sheen (0 → 1) from scroll. */}
      <g clipPath="url(#mx-clip)" style={{ mixBlendMode: "screen" }}>
        <rect
          x="-140"
          y="-40"
          width="110"
          height="340"
          fill="url(#mx-sheen)"
          transform="rotate(18 128 128)"
          style={{
            transform: "translateX(calc(var(--sheen, 0.35) * 420px)) rotate(18deg)",
            transformOrigin: "128px 128px",
          }}
        />
      </g>
    </svg>
  );
}
