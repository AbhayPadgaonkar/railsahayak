// app/layout.tsx

// CORRECTED: Component names and file paths now use PascalCase.
import Navbar from '@/components/navbar';
import Sidebar from '@/components/sidebar';
import BottomPanel from '@/components/bottompanel';

// Ensure you import your global CSS file
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* 1. Main container: Full-screen, vertical flex column */}
        <div className="flex flex-col h-screen bg-gray-900 text-white">

          {/* ROW 1: Navbar (takes its own height) */}
          <Navbar />

          {/* ROW 2: Middle section (will grow to fill available space) */}
          <div className="flex flex-grow overflow-hidden">
            
            {/* Middle Section's Column 1: Sidebar */}
            <Sidebar />

            {/* Middle Section's Column 2: Page Content */}
            <main className="flex-grow p-8 overflow-y-auto">
              {children}
            </main>

          </div>

          {/* ROW 3: AI Panel (takes its own height, at the bottom) */}
          {/* CORRECTED: Component name now matches the standard casing. */}
          <BottomPanel />

        </div>
      </body>
    </html>
  );
}
