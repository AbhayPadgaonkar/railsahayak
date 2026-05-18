"use client";

import React, { useState, useEffect, useRef } from "react";
import { Users, ChevronDown, SendHorizontal } from "lucide-react";


// --- TYPE DEFINITIONS ---
// Define a type for a single controller object
interface Controller {
  controller_id: string;
  name: string;
  section: string;
  status: "online" | "offline";
}

// Define a type for a single chat message
interface ChatMessage {
  from: "me" | "them" | "system";
  text: string;
}

// --- MOCK DATA WITH TYPES ---
// Mock data for controllers, typed as an array of Controller objects
const KNOWN_CONTROLLERS: Controller[] = [
  { controller_id: "CCG-VR", name: "Controller CCG-VR", section: "CCG-VR", status: "online" },
  { controller_id: "VR-VLSD", name: "Controller VR-VLSD", section: "VR-VLSD", status: "online" },
];

const DEFAULT_SELF: Controller = {
  controller_id: "CCG-VR",
  name: "Controller CCG-VR",
  section: "CCG-VR",
  status: "online",
};

export default function CommunicationGateway() {
  
  const [isOpen, setIsOpen] = useState(false);
  const [selfController, setSelfController] = useState<Controller>(DEFAULT_SELF);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [selectedController, setSelectedController] = useState<Controller | null>(null);
  const [messagesByController, setMessagesByController] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const controllerId = params.get("controller_id") || DEFAULT_SELF.controller_id;
    const name = params.get("name") || DEFAULT_SELF.name;
    const section = params.get("section") || DEFAULT_SELF.section;

    setSelfController({
      controller_id: controllerId,
      name,
      section,
      status: "online",
    });
  }, []);

  useEffect(() => {
    const peers = KNOWN_CONTROLLERS.filter(
      (controller) => controller.controller_id !== selfController.controller_id
    );
    setControllers(peers);
    setSelectedController(peers[0] || null);
  }, [selfController]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_COMM_WS_URL || "ws://localhost:8001";
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    setConnectionStatus("connecting");

    socket.onopen = () => {
      setConnectionStatus("connected");
      socket.send(
        JSON.stringify({
          type: "HANDSHAKE",
          controller_id: selfController.controller_id,
          name: selfController.name,
          section: selfController.section,
        })
      );
    };

    socket.onclose = () => setConnectionStatus("disconnected");
    socket.onerror = () => setConnectionStatus("error");

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "HANDSHAKE_ACK") {
        setConnectionStatus("ready");
        return;
      }

      if (message.type === "ERROR") {
        setMessagesByController((prev) => ({
          ...prev,
          system: [...(prev.system || []), { from: "system", text: message.reason }],
        }));
        return;
      }

      const fromId = message.from_controller_id || message.to_controller_id || "system";
      const text = message.text || JSON.stringify(message);
      setMessagesByController((prev) => ({
        ...prev,
        [fromId]: [...(prev[fromId] || []), { from: "them", text }],
      }));
    };

    return () => socket.close();
  }, [selfController]);

  // CORRECTED: Typed the controller parameter
  const handleSelectController = (controller: Controller) => {
    setSelectedController(controller);
    setIsOpen(false);
  };

  const handleSend = () => {
    if (!selectedController || !inputText.trim() || !wsRef.current) return;

    const payload = {
      type: "CHAT",
      msg_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      to_controller_id: selectedController.controller_id,
      text: inputText.trim(),
      requires_ack: true,
    };

    wsRef.current.send(JSON.stringify(payload));
    setMessagesByController((prev) => ({
      ...prev,
      [selectedController.controller_id]: [
        ...(prev[selectedController.controller_id] || []),
        { from: "me", text: inputText.trim() },
      ],
    }));
    setInputText("");
  };

  return (
    <aside className="bg-gray-800 text-gray-300 w-full lg:w-96 p-4 flex flex-col flex-shrink-0 border-l border-gray-700 h-full max-h-[40vh] lg:max-h-none">
      {/* Header with Dropdown */}
      <div className="flex justify-between items-center mb-4 px-2 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Communication
          </h2>
          <p className="text-xs text-gray-400">
            {selfController.section} • {connectionStatus}
          </p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 px-3 py-1 rounded-lg transition-colors"
          >
            <span>{selectedController?.name || "Select Controller"}</span>
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
                  {controllers.map((controller) => (
                    <li key={controller.controller_id}>
                      <button
                        onClick={() => handleSelectController(controller)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-sky-600 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="relative w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white"
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
          {selectedController
            ? `Chat with ${selectedController.section} (${selectedController.name})`
            : "Select a controller to start"}
        </h3>
        <div className="flex-grow space-y-3 text-sm overflow-y-auto pr-2 mb-3">
          {(selectedController
            ? messagesByController[selectedController.controller_id]
            : [])?.map((chat: ChatMessage, index: number) => (
            <div
              key={index}
              className={`text-gray-300 ${
                chat.from === "them" ? "text-right" : ""
              }`}
            >
              <p
                className={`p-2 rounded-lg inline-block ${
                  chat.from === "me"
                    ? "bg-blue-600/50"
                    : chat.from === "system"
                    ? "bg-amber-600/40"
                    : "bg-gray-700"
                }`}
              >
                {chat.text}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSend();
              }
            }}
            className="flex-grow bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-lg p-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
