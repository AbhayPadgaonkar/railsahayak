import React from 'react';
import Link from 'next/link';
import { Siren } from 'lucide-react';
import { GitPullRequestArrow } from 'lucide-react';
import { FileClock } from 'lucide-react';

export default function Sidebar() {
    return(    // Key classes: sticky, top-0, h-screen, w-64
    <aside className="bg-sky-200 text-black w-70   sticky top-0 flex-shrink-0">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Dashboard</h2>
        <nav>
          <ul>
           
            <li>
              <Link href="/crisismanagement" className=" flex items-center justify-start gap-2 py-2 px-4 rounded hover:bg-gray-700"><Siren className='w-6 h-6' />
                Crisis Management
              </Link>
            </li>
            <li>
              <Link href="/whatifsimulations" className="flex items-center justify-start gap-2 py-2 px-4 rounded hover:bg-gray-700"><GitPullRequestArrow className='w-6 h-6' />
                What If Simulations
              </Link>
            </li>
            <li>
              <Link href="/auditlogs" className="flex items-center justify-start gap-2 py-2 px-4 rounded hover:bg-gray-700"><FileClock className='w-6 h-6' />
                Audit Logs
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </aside>)
}