"use client";

import dynamic from "next/dynamic";

const YardCreator = dynamic(() => import("@/components/yardcreator"), {
  ssr: false,
});

export default function YardCreatorPage() {
  return (
    <div className="h-screen bg-gray-950 text-white">
      <YardCreator />
    </div>
  );
}
