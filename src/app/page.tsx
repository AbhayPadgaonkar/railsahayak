import Sidebar from "@/components/sidebar";
import AiRecommendationPanel from '@/components/aipanel'; 

export default function Home() {
  return (
  <div className="relative w-full h-full flex-1">

    <div className="justify-center text-4xl font-bold text-center mt-20">
      Welcome to RailSense!
    </div>
     <div className="flex h-screen bg-gray-900 text-white">
 <AiRecommendationPanel />
     </div>
      
  </div>
  );
}
