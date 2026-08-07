import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Route,
  MapPinned,
  MessagesSquare,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "G&SR Decision Engine",
    description:
      "Rule-based safety checks for signal authority, absolute block occupancy, fouling, turnout conflicts, and speed restrictions.",
  },
  {
    icon: Route,
    title: "Precedence Optimizer",
    description:
      "CP-SAT optimization for train ordering with IR priority rules and ghat-section goods-first exceptions.",
  },
  {
    icon: MapPinned,
    title: "Live Yard Map",
    description:
      "Config-driven yard diagrams for any station — signals, turnouts, sensor zones, and live train movement.",
  },
  {
    icon: MessagesSquare,
    title: "Controller Comms",
    description:
      "Structured controller-to-controller messaging with clearances, alerts, and emergency declarations.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-slate-800">
        <Image src="/RailSense.svg" alt="RailSense Logo" width={150} height={40} />
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 transition-colors text-sm font-medium"
        >
          Controller Login
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 lg:pt-28 pb-16">
        <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase">
          Indian Railways — Section Control
        </span>
        <h1 className="mt-4 text-4xl lg:text-6xl font-bold leading-tight max-w-3xl">
          Decision support for the people who keep trains moving
        </h1>
        <p className="mt-6 max-w-2xl text-slate-400 text-lg">
          RailSahayak combines G&SR-aligned safety rules, precedence
          optimization, and a live yard diagram into one control-room dashboard
          for section controllers.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 transition-colors font-medium"
          >
            Sign in to Dashboard
          </Link>
          <a
            href="#features"
            className="px-6 py-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors font-medium"
          >
            Learn more
          </a>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="px-6 lg:px-12 pb-20 grid gap-6 sm:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto w-full"
      >
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 hover:border-sky-700 transition-colors"
          >
            <feature.icon className="w-8 h-8 text-sky-400" />
            <h3 className="mt-4 font-semibold text-lg">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 px-6 lg:px-12 py-6 text-sm text-slate-500 flex justify-between">
        <span>RailSahayak — prototype for section controller decision support</span>
        <span>G&SR aligned</span>
      </footer>
    </div>
  );
}
