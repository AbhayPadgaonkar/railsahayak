"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { AuthSession, getSession, logout } from "@/lib/auth";

export default function Navbar() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  // Formatting options for the time (no changes here)
  const timeFormatOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  return (
    // Main navbar container with a modern feel
    <div className="w-full h-12 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm  border border-slate-300/10 px-4 lg:px-8">
      {/* Left Side: Logo */}
      <div>
        <Image
          src="/RailSense.svg"
          alt="RailSense Logo"
          width={150} // Slightly adjusted for better visual balance
          height={40}
          className="transition duration-300 ease-in-out hover:-translate-y-1 hover:scale-110"
        />
      </div>

      {/* Center: Section & Controller Info */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Section:</span>
          <span className="font-medium text-slate-100">
            {session?.section ?? "—"}
          </span>
        </div>

        {/* A subtle vertical separator */}
        <div className="w-px h-6 bg-slate-700"></div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Controller:</span>
          <span className="font-medium text-slate-100">
            {session ? `${session.name} - ${session.controller_id}` : "—"}
          </span>
        </div>
      </div>

      {/* Right Side: Live Clock + Logout */}
      <div className="flex items-center gap-4 text-slate-200">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-400" />
          <div className="font-mono text-base tracking-wider">
            {currentTime
              ? currentTime.toLocaleString("en-GB", timeFormatOptions)
              : null}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
