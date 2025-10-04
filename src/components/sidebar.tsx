import React from 'react';
import Link from 'next/link';
import { Siren, GitPullRequestArrow, FileClock } from 'lucide-react';
import { BotMessageSquare } from 'lucide-react';

export default function Sidebar() {
  return (
    // Main container: Dark theme, fixed width, full height, and subtle right border for separation.
    <aside className="bg-gray-800 text-gray-300 w-55 h-full pt-4 flex flex-col flex-shrink-0 border-r border-gray-700">
      
      {/* Sidebar Header */}
      <div className="mb-8 px-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
      </div>
      
      {/* Navigation Links */}
      <nav>
        {/* Using space-y-2 for consistent vertical spacing between links */}
        <ul className="space-y-2">
          <li>
            <Link 
              href="/crisismanagement" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <Siren className='w-5 h-5' />
              <span>Crisis Management</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/whatifsimulations" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <GitPullRequestArrow className='w-5 h-5' />
              <span>What If Simulations</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/auditlogs" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <FileClock className='w-5 h-5' />
              <span>Audit Logs</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/auditlogs" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <BotMessageSquare className='w-5 h-5'  />
              <span>Chat Assistant</span>
            </Link>
          </li>
        </ul>
      </nav>
      
      {/* This div pushes content to the bottom of the sidebar, useful for a user profile or logout button */}
      <div className="mt-auto">
        {/* You can add a user profile component here */}
      </div>
    </aside>
  );
}
