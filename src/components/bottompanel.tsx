import AiRecommendationPanel from './aipanel';
import CommunicationGateway from './communication';

export default function BottomPanel() {
  return (
    // This container uses flexbox to arrange its children horizontally.
    // The border is applied here for a unified look.
    <div className="flex border-t border-gray-800 min-h-60 flex-shrink-0">
      {/* The AI Panel will grow to fill the available space */}
      <AiRecommendationPanel />
      {/* The Communication Gateway will have a fixed width */}
      <CommunicationGateway />
    </div>
  );
}
