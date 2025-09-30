'use client';

import React, { useState } from 'react';

// Type definition for a single recommendation card's data
interface RecommendationCardProps {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  duration: string;
  description: string;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

// RecommendationCard component for dark theme
const RecommendationCard = ({
  id,
  title,
  priority,
  location,
  duration,
  description,
  onAccept,
  onDismiss,
}: RecommendationCardProps) => {
  const priorityColorClass = {
    HIGH: 'bg-red-700 text-red-100',
    MEDIUM: 'bg-orange-700 text-orange-100',
    LOW: 'bg-blue-700 text-blue-100',
  }[priority];

  return (
    // ADDED a minimum height (min-h-60) and REMOVED redundant flex-shrink-0 class.
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 transition-all duration-200 hover:shadow-2xl hover:border-gray-600 flex flex-col h-full min-h-60">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityColorClass}`}>
          {priority}
        </span>
      </div>
      
      {/* Content area that needs to stretch */}
      <div className="flex-grow flex flex-col justify-end">
        <p className="text-sm text-gray-400 mb-1">
          <strong className="font-medium text-gray-300">Location:</strong> {location}
        </p>
        <p className="text-sm text-gray-400 mb-3">
          <strong className="font-medium text-gray-300">Duration:</strong> {duration}
        </p>
        <p className="text-sm text-gray-500 italic mb-4">
          {description}
        </p>
      </div>

      {/* Buttons will now always be at the bottom */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onAccept(id)}
          className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2 px-3 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(id)}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-3 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// Main AI Recommendation Panel component
const AIRecommendationPanel = () => {
  const recommendations: RecommendationCardProps[] = [
    {
      id: 'rec-1',
      title: 'Divert Local 90302 to Loop Line',
      priority: 'HIGH',
      location: 'DN Slow Junction',
      duration: 'Approx. 3 mins',
      description: 'High-priority 12926 Express approaching. Divert slower 90302 to allow overtake.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
    {
      id: 'rec-2',
      title: 'Adjust Speed for 70014',
      priority: 'MEDIUM',
      location: 'UP Main Track (MP 123.5)',
      duration: 'Ongoing',
      description: 'Maintain 60 mph to optimize arrival time at next station, avoiding congestion.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
    {
      id: 'rec-3',
      title: 'Hold Freight 50020 at Siding B',
      priority: 'LOW',
      location: 'Yard Siding B',
      duration: 'Approx. 15 mins',
      description: 'Allow two passenger services to pass before releasing freight train 50020.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
    {
      id: 'rec-4',
      title: 'Inspect Track Segment 3A',
      priority: 'HIGH',
      location: 'Segment 3A (MP 45-46)',
      duration: 'Immediate',
      description: 'Sensor anomaly detected. Urgent inspection required to prevent potential fault.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
     {
      id: 'rec-5',
      title: 'Inspect Track Segment 3A',
      priority: 'HIGH',
      location: 'Segment 3A (MP 45-46)',
      duration: 'Immediate',
      description: 'Sensor anomaly detected. Urgent inspection required to prevent potential fault.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
    {
      id: 'rec-6',
      title: 'Reschedule Maintenance Window',
      priority: 'LOW',
      location: 'Central Yard',
      duration: 'Next Cycle',
      description: 'Delay non-critical maintenance by 2 hours to prioritize high-traffic period.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
    {
      id: 'rec-7',
      title: 'Alert Crew of 12926',
      priority: 'MEDIUM',
      location: 'Approaching VR-BL Section',
      duration: 'N/A',
      description: 'Inform crew of potential signal maintenance ahead, advise caution.',
      onAccept: (id) => console.log(`Accepted: ${id}`),
      onDismiss: (id) => console.log(`Dismissed: ${id}`),
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Corresponds to xl:grid-cols-5 to show one full row

  const totalPages = Math.ceil(recommendations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecommendations = recommendations.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };


  return (
    // REMOVED max-height and flex properties from this container
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-950/80 border-t border-gray-800 backdrop-blur-sm rounded-t-lg">
      <div className="flex justify-between items-center mb-4 px-4">
        <h2 className="text-xl font-bold text-gray-100">AI Recommendations</h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrevPage} 
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              &lt;
            </button>
            <span className="text-sm font-medium text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={handleNextPage} 
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              &gt;
            </button>
          </div>
        )}
      </div>
      {/* REMOVED overflow-y-auto, the content will now paginate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 pb-2">
        {currentRecommendations.map((rec) => (
          <RecommendationCard key={rec.id} {...rec} />
        ))}
      </div>
    </div>
  );
};

export default AIRecommendationPanel;

