import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Route,
  MapPinned,
  MessagesSquare,
  Clock,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    accent: "text-emerald-400",
    dot: "bg-emerald-400",
    title: "G&SR Decision Engine",
    sub: "सुरक्षा नियम",
    description:
      "Rule-based safety checks for signal authority, absolute block occupancy, fouling, turnout conflicts, and speed restrictions.",
  },
  {
    icon: Route,
    accent: "text-amber-400",
    dot: "bg-amber-400",
    title: "Precedence Optimizer",
    sub: "रेल क्रम निर्धारण",
    description:
      "CP-SAT optimization for train ordering with IR priority rules and ghat-section goods-first exceptions.",
  },
  {
    icon: MapPinned,
    accent: "text-sky-400",
    dot: "bg-sky-400",
    title: "Live Yard Map",
    sub: "लाइव यार्ड नक्शा",
    description:
      "Config-driven yard diagrams for any station — signals, turnouts, sensor zones, and live train movement.",
  },
  {
    icon: MessagesSquare,
    accent: "text-rose-400",
    dot: "bg-rose-400",
    title: "Controller Comms",
    sub: "संचार व्यवस्था",
    description:
      "Structured controller-to-controller messaging with clearances, alerts, and emergency declarations.",
  },
];

const SignalPost = ({ color, x }: { color: string; x: number }) => (
  <g transform={`translate(${x}, 0)`}>
    <line x1={0} y1={10} x2={0} y2={100} stroke="#64748b" strokeWidth={4} />
    <rect x={-16} y={-26} width={32} height={70} rx={6} fill="#334155" stroke="#475569" />
    <circle cx={0} cy={-14} r={7} fill={color === "red" ? "#ef4444" : "#1e293b"} />
    <circle cx={0} cy={8} r={7} fill={color === "yellow" ? "#facc15" : "#1e293b"} />
    <circle cx={0} cy={30} r={7} fill={color === "green" ? "#22c55e" : "#1e293b"} />
    <line x1={-16} y1={44} x2={16} y2={44} stroke="#7c3aed" strokeWidth={3} />
  </g>
);

const TrackScene = () => (
  <svg
    viewBox="0 0 1200 220"
    className="w-full h-40 lg:h-52 opacity-90"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden
  >
    {/* sky */}
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0b1f3a" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="engine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    <rect width="1200" height="220" fill="url(#sky)" />

    {/* signal gantries */}
    <SignalPost color="red" x={140} />
    <SignalPost color="green" x={1060} />

    {/* rails */}
    <line x1={0} y1={150} x2={1200} y2={150} stroke="#94a3b8" strokeWidth={5} />
    <line x1={0} y1={175} x2={1200} y2={175} stroke="#94a3b8" strokeWidth={5} />
    {/* sleepers */}
    {Array.from({ length: 30 }).map((_, i) => (
      <rect
        key={i}
        x={i * 42 + 8}
        y={140}
        width={26}
        height={45}
        rx={3}
        fill="#475569"
        opacity={0.85}
      />
    ))}

    {/* engine */}
    <g transform="translate(430, 86)">
      <rect x={0} y={16} width={170} height={58} rx={10} fill="url(#engine)" />
      <rect x={0} y={16} width={170} height={16} rx={8} fill="#fdba74" />
      <rect x={160} y={24} width={4} height={42} rx={2} fill="#fef3c7" />
      <circle cx={24} cy={74} r={15} fill="#0f172a" />
      <circle cx={24} cy={74} r={6} fill="#94a3b8" />
      <circle cx={146} cy={74} r={15} fill="#0f172a" />
      <circle cx={146} cy={74} r={6} fill="#94a3b8" />
    </g>

    {/* coaches */}
    <g transform="translate(20, 112)">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 150}, 0)`}>
          <rect x={0} y={0} width={136} height={46} rx={8} fill="#e2e8f0" />
          <rect x={0} y={0} width={136} height={10} rx={6} fill="#cbd5e1" />
          {[0, 1, 2, 3].map((w) => (
            <rect key={w} x={12 + w * 30} y={14} width={18} height={22} rx={3} fill="#334155" />
          ))}
        </g>
      ))}
    </g>

    <SignalPost color="yellow" x={760} />
  </svg>
);

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b1f3a] text-slate-100 flex flex-col">
      {/* Tricolor accent strip */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-orange-500" />
        <div className="flex-1 bg-slate-100" />
        <div className="flex-1 bg-emerald-600" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-slate-700/60 bg-[#0d2549]/90">
        <Image src="/RailSense.svg" alt="RailSense Logo" width={150} height={40} />
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-slate-400 tracking-wide">
            सेक्शन कंट्रोल | Section Control Suite
          </span>
          <Link
            href="/login"
            className="px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-400 transition-colors text-sm font-semibold text-white shadow-lg shadow-orange-900/40"
          >
            Controller Login →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-14 lg:pt-20 pb-10">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-400/40 bg-orange-500/10 text-orange-300 text-xs font-semibold tracking-widest uppercase">
          G&SR Aligned · IR Precedence Rules
        </span>
        <h1 className="mt-5 text-4xl lg:text-6xl font-black leading-tight max-w-3xl">
          Rail<span className="text-orange-400">Sahayak</span>
          <span className="block mt-2 text-2xl lg:text-3xl font-serif font-semibold text-slate-300">
            सुरक्षित संचालन, समय पर रेलें
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-slate-400 text-lg">
          Decision support for the people who keep trains moving — safety rules,
          precedence optimization and a live yard diagram in one control-room
          dashboard for Indian Railways section controllers.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="px-7 py-3 rounded-md bg-orange-500 hover:bg-orange-400 transition-colors font-semibold shadow-lg shadow-orange-900/40"
          >
            Sign in to Dashboard
          </Link>
          <a
            href="#features"
            className="px-7 py-3 rounded-md border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 transition-colors font-semibold"
          >
            Learn more ↓
          </a>
        </div>
      </section>

      {/* Track scene */}
      <div className="px-0 overflow-hidden">
        <TrackScene />
      </div>

      {/* Features */}
      <section
        id="features"
        className="px-6 lg:px-12 py-20 grid gap-6 sm:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto w-full scroll-mt-6"
      >
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-700 bg-[#0d2549]/70 p-6 hover:border-orange-400/60 hover:-translate-y-1 transition-all shadow-lg shadow-black/20"
          >
            <div className="flex items-center justify-between">
              <feature.icon className={`w-8 h-8 ${feature.accent}`} />
              <span
                className={`w-2.5 h-2.5 rounded-full ${feature.dot} shadow-lg shadow-black/40`}
              />
            </div>
            <h3 className="mt-4 font-bold text-lg">{feature.title}</h3>
            <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase">
              {feature.sub}
            </p>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      {/* Strip / CTA band */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto rounded-xl border border-orange-400/40 bg-gradient-to-r from-[#0d2549] to-[#123153] px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Clock className="w-10 h-10 text-emerald-400" />
            <div>
              <h3 className="text-xl font-bold">
                One dashboard. Every control decision.
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Signals, occupancy, precedence and comms — aligned with Indian
                Railways operating rules.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="px-7 py-3 rounded-md bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold whitespace-nowrap"
          >
            Open Control Room
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-700 bg-[#081a33] px-6 lg:px-12 py-6 text-sm text-slate-500 flex flex-col md:flex-row items-center justify-between gap-3">
        <span>RailSahayak — prototype for section-controller decision support</span>
        <span className="font-serif text-slate-400">भारतीय रेलवे · inspired design</span>
        <span>Not affiliated with the Ministry of Railways.</span>
      </footer>
    </div>
  );
}