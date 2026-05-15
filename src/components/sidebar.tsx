"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Siren, GitPullRequestArrow, FileClock } from "lucide-react";
import { BotMessageSquare } from "lucide-react";
import { ChartColumn } from "lucide-react";
import { MapPinned } from "lucide-react";
// import CommunicationGateway  from './communication';

export default function Sidebar() {
  const pathname = usePathname(); // ✅ get current route

  return (
    <aside className="bg-gray-800 text-gray-300 w-full lg:w-64 h-auto lg:h-full pt-2 lg:pt-4 flex flex-col flex-shrink-0 border-r border-gray-700">
      {/* Navigation Links */}
      <nav className="px-3 lg:px-5">
        <ul className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2">
          <li>
            <Link
              href="/"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
                pathname === "/"
                  ? "bg-sky-600 text-white"
                  : "hover:bg-sky-600 hover:text-white"
              } whitespace-nowrap`}
            >
              <MapPinned className="w-5 h-5" />
              <span>Live Map</span>
            </Link>
          </li>
          <li>
            <Link
              href="/crisismanagement"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
                pathname === "/crisismanagement"
                  ? "bg-sky-600 text-white"
                  : "hover:bg-sky-600 hover:text-white"
              } whitespace-nowrap`}
            >
              <Siren className="w-5 h-5" />
              <span>Crisis Management</span>
            </Link>
          </li>
          <li>
            <Link
              href="/whatifsimulations"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
                pathname === "/whatifsimulations"
                  ? "bg-sky-600 text-white"
                  : "hover:bg-sky-600 hover:text-white"
              } whitespace-nowrap`}
            >
              <GitPullRequestArrow className="w-5 h-5" />
              <span>What If Simulations</span>
            </Link>
          </li>
          <li>
            <Link
              href="/auditlogs"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
                pathname === "/auditlogs"
                  ? "bg-sky-600 text-white"
                  : "hover:bg-sky-600 hover:text-white"
              } whitespace-nowrap`}
            >
              <FileClock className="w-5 h-5" />
              <span>Audit Logs</span>
            </Link>
          </li>
          <li>
            <Link
              href="/kpiboard"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
                pathname === "/kpiboard"
                  ? "bg-sky-600 text-white"
                  : "hover:bg-sky-600 hover:text-white"
              } whitespace-nowrap`}
            >
              <ChartColumn className="w-5 h-5" />
              <span>KPI Dashboard</span>
            </Link>
          </li>
          <li>
            <Link
              href="/chatassistant"
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
                pathname === "/chatassistant"
                  ? "bg-sky-600 text-white"
                  : "hover:bg-sky-600 hover:text-white"
              } whitespace-nowrap`}
            >
              <BotMessageSquare className="w-5 h-5" />
              <span>Chat Assistant</span>
            </Link>
          </li>
          {/* <CommunicationGateway  /> */}
        </ul>
      </nav>

      <div className="mt-auto">
        {/* You can add a user profile component here */}
      </div>
    </aside>
  );
}
