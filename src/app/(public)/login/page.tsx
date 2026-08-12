"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LogIn, LoaderCircle } from "lucide-react";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [controllerId, setControllerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(controllerId.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-slate-100 flex items-center justify-center px-6">
      <div className="fixed top-0 left-0 right-0 flex h-1.5">
        <div className="flex-1 bg-orange-500" />
        <div className="flex-1 bg-slate-100" />
        <div className="flex-1 bg-emerald-600" />
      </div>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Link href="/">
            <Image src="/RailSense.svg" alt="RailSense Logo" width={180} height={48} />
          </Link>
          <p className="mt-3 text-slate-400 text-sm">
            Section Controller Sign In
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 flex flex-col gap-5"
        >
          <div>
            <label htmlFor="controller_id" className="block text-sm text-slate-400 mb-1.5">
              Controller ID
            </label>
            <input
              id="controller_id"
              type="text"
              required
              autoComplete="username"
              value={controllerId}
              onChange={(e) => setControllerId(e.target.value)}
              placeholder="e.g. CCG-VR"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-slate-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors py-2.5 font-medium"
          >
            {loading ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Demo credentials: CCG-VR / ccgvr123 · VR-VLSD / vrvlsd123 · VR-BL / vrbl123
          </p>
        </form>
      </div>
    </div>
  );
}
