import React from 'react';
import Link from 'next/link';
import { Siren, GitPullRequestArrow, FileClock } from 'lucide-react';
import { BotMessageSquare } from 'lucide-react';
import { ChartColumn } from 'lucide-react';
import { MapPinned } from 'lucide-react';
// import CommunicationGateway  from './communication';

export default function Sidebar() {
  return (
    // Main container: Dark theme, fixed width, full height, and subtle right border for separation.
    <aside className="bg-gray-800 text-gray-300 w-85 h-full pt-4 flex flex-col flex-shrink-0 border-r border-gray-700">
      
      
      {/* Navigation Links */}
      <nav className='pl-5'>
        {/* Using space-y-2 for consistent vertical spacing between links */}
        <ul className="space-y-2">
                <li>
            <Link 
              href="/#" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <MapPinned className='w-5 h-5' />
              <span>Live Map</span>
            </Link>
          </li>
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
              href="/kpiboard" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <ChartColumn  className='w-5 h-5' />
              <span>KPI Dashboard</span>
            </Link>
          </li>
          <li>
            <Link 
              href="" 
              className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-200 hover:bg-sky-600 hover:text-white"
            >
              <BotMessageSquare className='w-5 h-5'  />
              <span>Chat Assistant</span>
            </Link>
          </li>
          {/* <CommunicationGateway  /> */}
        </ul>
      </nav>
      
      {/* This div pushes content to the bottom of the sidebar, useful for a user profile or logout button */}
      <div className="mt-auto">
        {/* You can add a user profile component here */}
      </div>
    </aside>
  );
}
