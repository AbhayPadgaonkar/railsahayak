import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import BottomPanel from "@/components/bottompanel";
import AuthGuard from "@/components/authguard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        {/* ROW 1: Navbar */}
        <Navbar />

        {/* ROW 2: Middle section */}
        <div className="flex flex-col lg:flex-row flex-grow overflow-hidden min-h-0">
          <Sidebar />
          <main className="flex-grow p-1 overflow-y-auto min-h-0">
            {children}
          </main>
        </div>

        {/* ROW 3: AI Panel */}
        <BottomPanel />
      </div>
    </AuthGuard>
  );
}
