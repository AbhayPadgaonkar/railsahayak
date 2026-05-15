"use client"
import AiRecommendationPanel from "./aipanel";
import dynamic from "next/dynamic";

const CommunicationGateway = dynamic(() => import("@/components/communication"), {
  ssr: false, // 🚀 client-only
});

export default function BottomPanel() {
  return (
    // This container uses flexbox to arrange its children horizontally.
    // The border is applied here for a unified look.
    <div className="flex flex-col lg:flex-row border-t border-gray-800 h-[260px] lg:h-[320px] flex-shrink-0">
      {/* The AI Panel will grow to fill the available space */}
      <AiRecommendationPanel />
      {/* The Communication Gateway will have a fixed width */}
      <CommunicationGateway />
    </div>
  );
}
