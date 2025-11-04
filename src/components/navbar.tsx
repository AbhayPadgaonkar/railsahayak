"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Clock } from "lucide-react"; // Import a clock icon

export default function Navbar() {
  // 1. State for the current time (no changes here)
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // 2. Set the *actual* time only on the client.
    setCurrentTime(new Date());

    // 3. Your interval logic is perfect and updates the time.
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []); // Empty array ensures this runs only on the client, after mount.

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
          <span className="font-medium text-slate-100">VR-BL</span>
        </div>

        {/* A subtle vertical separator */}
        <div className="w-px h-6 bg-slate-700"></div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Controller:</span>
          <span className="font-medium text-slate-100">Full Name - ID</span>
        </div>
      </div>

      {/* Right Side: Live Clock */}
      <div className="flex items-center gap-2 text-slate-200">
        <Clock className="h-4 w-4 text-sky-400" />
        <div className="font-mono text-base tracking-wider">
          {currentTime
            ? currentTime.toLocaleString("en-GB", timeFormatOptions)
            : null}
        </div>
      </div>
    </div>
  );
}
