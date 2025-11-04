"use client";

import React, { useState, useEffect } from "react";

// Recommendation data type
interface Recommendation {
  id: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  location: string;
  duration: string;
  description: string;
}

// Individual recommendation card component
const RecommendationCard = ({
  id,
  title,
  priority,
  location,
  duration,
  description,
  onAccept,
  onDismiss,
}: Recommendation & {
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) => {
  const priorityColorClass = {
    HIGH: "bg-red-700 text-red-100",
    MEDIUM: "bg-orange-700 text-orange-100",
    LOW: "bg-blue-700 text-blue-100",
  }[priority];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 hover:shadow-xl hover:border-gray-600 transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityColorClass}`}
          >
            {priority}
          </span>
        </div>
        <p className="text-sm text-gray-400">
          <strong className="text-gray-300">Location:</strong> {location}
        </p>
        <p className="text-sm text-gray-400 mb-3">
          <strong className="text-gray-300">Duration:</strong> {duration}
        </p>
        <p className="text-sm text-gray-500 italic mb-4">{description}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(id)}
          className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(id)}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// Hook to calculate items per page (responsive)
const useItemsPerPage = () => {
  const [itemsPerPage, setItemsPerPage] = useState<number | null>(null);

  useEffect(() => {
    const getItemsCount = () => {
      if (window.innerWidth >= 1024) return 4;
      if (window.innerWidth >= 640) return 2;
      return 1;
    };

    setItemsPerPage(getItemsCount());
    const handleResize = () => setItemsPerPage(getItemsCount());

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return itemsPerPage;
};


// Main AI Recommendation Panel
const AIRecommendationPanel = () => {
  // Hardcoded data (will be fetched later)
  const recommendations: Recommendation[] = [
    {
      id: "rec-1",
      title: "Divert Local 90302 to Loop Line",
      priority: "HIGH",
      location: "DN Slow Junction",
      duration: "Approx. 3 mins",
      description:
        "High-priority 12926 Express approaching. Divert slower 90302 to allow overtake.",
    },
    {
      id: "rec-2",
      title: "Adjust Speed for 70014",
      priority: "MEDIUM",
      location: "UP Main Track (MP 123.5)",
      duration: "Ongoing",
      description:
        "Maintain 60 mph to optimize arrival time at next station, avoiding congestion.",
    },
    {
      id: "rec-3",
      title: "Hold Freight 50020 at Siding B",
      priority: "LOW",
      location: "Yard Siding B",
      duration: "Approx. 15 mins",
      description:
        "Allow two passenger services to pass before releasing freight train 50020.",
    },
    {
      id: "rec-4",
      title: "Inspect Track Segment 3A",
      priority: "HIGH",
      location: "Segment 3A (MP 45-46)",
      duration: "Immediate",
      description:
        "Sensor anomaly detected. Urgent inspection required to prevent potential fault.",
    },
    {
      id: "rec-5",
      title: "Alert Crew of 12926",
      priority: "MEDIUM",
      location: "Approaching VR-BL Section",
      duration: "N/A",
      description:
        "Inform crew of potential signal maintenance ahead, advise caution.",
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useItemsPerPage();
  useEffect(() => {
  if (itemsPerPage && currentPage > Math.ceil(recommendations.length / itemsPerPage)) {
    setCurrentPage(1); // reset to first page if layout changes
  }
}, [itemsPerPage]);


  if (itemsPerPage === null) return null; // Wait until client mounts

  const totalPages = Math.ceil(recommendations.length / itemsPerPage!);
  const startIndex = (currentPage - 1) * itemsPerPage!;
  const endIndex = startIndex + itemsPerPage!;
  const currentRecommendations = recommendations.slice(startIndex, endIndex);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  const handleAccept = (id: string) => console.log(`✅ Accepted: ${id}`);
  const handleDismiss = (id: string) => console.log(`❌ Dismissed: ${id}`);

  return (
    <div className="bottom-0 left-0 right-0 z-50 p-4 bg-gray-950/80 border-t border-gray-800 backdrop-blur-sm rounded-t-lg">
      <div className="flex justify-between items-center mb-4 px-4">
        <h2 className="text-xl font-bold text-gray-100">AI Recommendations</h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            <span className="text-sm font-medium text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2 pb-4">
        {currentRecommendations.map((rec) => (
          <RecommendationCard
            key={rec.id}
            {...rec}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
};

export default AIRecommendationPanel;
