"use client";

import React, { useState, useEffect, useRef } from "react";
import { Users, ChevronDown, SendHorizontal } from "lucide-react";


// --- TYPE DEFINITIONS ---
// Define a type for a single controller object
interface Controller {
  id: number;
  name: string;
  section: string;
  status: "online" | "offline";
}

// Define a type for a single chat message
interface ChatMessage {
  from: "me" | "them";
  text: string;
}

// --- MOCK DATA WITH TYPES ---
// Mock data for controllers, typed as an array of Controller objects
const adjacentControllers: Controller[] = [
  { id: 1, name: "R. Sharma", section: "VR-ST", status: "online" },
  { id: 2, name: "S. Gupta", section: "BL-MM", status: "online" },
  { id: 3, name: "P. Verma", section: "ST-PL", status: "offline" },
];

// Mock chat history, typed to be indexable by a number
const chatHistories: { [key: number]: ChatMessage[] } = {
  1: [
    {
      from: "me",
      text: "Train 12926 approaching your section. Confirm track is clear.",
    },
    { from: "them", text: "Track confirmed clear for 12926. Proceed." },
  ],
  2: [{ from: "me", text: "Any updates on the signal at MP 255.5?" }],
  3: [{ from: "them", text: "Offline. Last seen 2 hours ago." }],
};

export default function CommunicationGateway() {
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedController, setSelectedController] = useState<Controller>(
    adjacentControllers[0]
  );

  // CORRECTED: Typed the ref to be a DIV element
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // CORRECTED: Typed the event parameter as a MouseEvent
    const handleClickOutside = (event: MouseEvent) => {
      // The 'contains' error is now resolved because the ref is properly typed
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // CORRECTED: Typed the controller parameter
  const handleSelectController = (controller: Controller) => {
    setSelectedController(controller);
    setIsOpen(false);
  };

  return (
    <aside className="bg-gray-800 text-gray-300 w-96 p-4 flex flex-col flex-shrink-0 border-l border-gray-700 h-full">
      {/* Header with Dropdown */}
      <div className="flex justify-between items-center mb-4 px-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Communication
        </h2>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 px-3 py-1 rounded-lg transition-colors"
          >
            <span>{selectedController.name}</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10">
              <div className="p-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                  <Users size={14} />
                  Select Controller
                </h3>
                <ul className="space-y-1">
                  {adjacentControllers.map((controller) => (
                    <li key={controller.id}>
                      <button
                        onClick={() => handleSelectController(controller)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-sky-600 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`relative w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white`}
                          >
                            {controller.name.charAt(0)}
                            <span
                              className={`absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-1 ring-gray-700 ${
                                controller.status === "online"
                                  ? "bg-green-500"
                                  : "bg-gray-500"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-white text-sm">
                              {controller.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {controller.section}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 flex flex-col flex-grow min-h-60">
        <h3 className="text-sm font-semibold text-gray-200 mb-3 flex-shrink-0">
          Chat with {selectedController.section} ({selectedController.name})
        </h3>
        <div className="flex-grow space-y-3 text-sm overflow-y-auto pr-2 mb-3">
          {/* The indexing error is now resolved because chatHistories is properly typed */}
          {chatHistories[selectedController.id]?.map(
            (chat: ChatMessage, index: number) => (
              <div
                key={index}
                className={`text-gray-300 ${
                  chat.from === "them" ? "text-right" : ""
                }`}
              >
                <p
                  className={`p-2 rounded-lg inline-block ${
                    chat.from === "me" ? "bg-blue-600/50" : "bg-gray-700"
                  }`}
                >
                  {chat.text}
                </p>
              </div>
            )
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-grow bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-lg p-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <button className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors">
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
