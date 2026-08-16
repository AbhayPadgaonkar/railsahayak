"use client";

import React, { useState, useEffect } from "react";
import { Advisory, applyAdvisory, getAdvisories } from "@/lib/api";

// Individual recommendation card component
const RecommendationCard = ({
  id,
  title,
  priority,
  location,
  duration,
  description,
  pending,
  onAccept,
  onDismiss,
  section_name,
}: Advisory & {
  pending?: "accept" | "dismiss" | null;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) => {
  const priorityColorClass = {
    HIGH: "bg-red-700 text-red-100",
    MEDIUM: "bg-orange-700 text-orange-100",
    LOW: "bg-blue-700 text-blue-100",
  }[priority];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2.5 hover:shadow-xl hover:border-gray-600 transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-white leading-snug">{title}</h3>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${priorityColorClass}`}
          >
            {priority}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 leading-snug">
          <strong className="text-gray-300">Location:</strong> {location}
          {section_name ? (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px] font-medium">
              {section_name}
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-gray-400 leading-snug mb-1.5">
          <strong className="text-gray-300">Duration:</strong> {duration}
        </p>
        <p className="text-[11px] text-gray-500 italic mb-2 line-clamp-2">{description}</p>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => onAccept(id)}
          disabled={pending === "accept"}
          className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-900 disabled:cursor-wait text-white font-semibold py-1 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-[11px]"
        >
          {pending === "accept" ? "Applying…" : "Accept"}
        </button>
        <button
          onClick={() => onDismiss(id)}
          disabled={pending === "dismiss"}
          className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-wait text-gray-200 font-semibold py-1 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 text-[11px]"
        >
          {pending === "dismiss" ? "Dismissing…" : "Dismiss"}
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
  const [recommendations, setRecommendations] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getAdvisories();
        if (active) setRecommendations(res.advisories);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load advisories");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pendingIds, setPendingIds] = useState<
    Record<string, "accept" | "dismiss">
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const itemsPerPage = useItemsPerPage();
  useEffect(() => {
    if (
      itemsPerPage &&
      currentPage > Math.ceil(recommendations.length / itemsPerPage)
    ) {
      setCurrentPage(1);
    }
  }, [itemsPerPage, recommendations.length, currentPage]);

  const runAction = async (id: string, action: "accept" | "dismiss") => {
    setActionError(null);
    setPendingIds((prev) => ({ ...prev, [id]: action }));
    try {
      await applyAdvisory(id, action);
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : `Failed to ${action} advisory`
      );
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleAccept = (id: string) => runAction(id, "accept");
  const handleDismiss = (id: string) => runAction(id, "dismiss");

  if (itemsPerPage === null) return null; // Wait until client mounts

  const totalPages = Math.max(1, Math.ceil(recommendations.length / itemsPerPage!));
  const startIndex = (currentPage - 1) * itemsPerPage!;
  const endIndex = startIndex + itemsPerPage!;
  const currentRecommendations = recommendations.slice(startIndex, endIndex);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  return (
    <div className="bottom-0 left-0 right-0 z-50 p-2 bg-gray-950/80 border-t border-gray-800 backdrop-blur-sm rounded-t-lg flex flex-col flex-1 min-h-0">
      <div className="flex justify-between items-center mb-1 px-2">
        <h2 className="text-base font-bold text-gray-100">AI Recommendations</h2>
        {actionError && (
          <p className="text-[11px] text-red-400">{actionError}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              &lt;
            </button>
            <span className="text-xs font-medium text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              &gt;
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 px-1 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <p className="text-xs text-gray-500 px-2">Loading advisories…</p>
        ) : error ? (
          <p className="text-xs text-red-400 px-2">{error}</p>
        ) : currentRecommendations.length === 0 ? (
          <p className="text-xs text-gray-500 px-2">
            No active advisories. Section running clear.
          </p>
        ) : (
          currentRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              {...rec}
              pending={pendingIds[rec.id] ?? null}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AIRecommendationPanel;
