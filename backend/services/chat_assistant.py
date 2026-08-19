import re
from typing import Dict, List, Optional

from backend.services.decision_state import active_decisions, record_action
from backend.services.crisis_state import active_crises, disaster_active
from backend.services.section_sim import section_sim
from backend.api.advisory import _build_advisories

# Rule-based controller assistant over live G&SR state. Each handler inspects
# the current sim / crisis / decision state and returns a plain-language answer
# plus a list of structured fact chips for the UI.


def _decision_map() -> Dict[str, dict]:
    return {d["train_id"]: d for d in active_decisions()}


def _live_trains() -> List[dict]:
    section_sim.tick()  # advance so the roster reflects live trains
    return [
        {
            "train_id": t.train_id,
            "train_type": t.train_type,
            "block_id": t.block_id,
            "line_id": t.line_id,
            "speed_kmph": t.speed_kmph,
        }
        for t in section_sim.trains
    ]


def _section_of_block(block_id: str) -> Optional[str]:
    station = section_sim._block_station.get(block_id)
    if not station:
        return None
    for sec in section_sim.sections:
        if station in sec["stations"]:
            return f"{sec['name']} ({sec['controller_id']})"
    return None


def _handle_help() -> dict:
    return {
        "answer": (
            "I can help you operate the line. Try asking:\n"
            "• \"status\" — overall line, sections, crisis & advisory snapshot\n"
            "• \"trains\" — live roster on the line\n"
            "• \"disaster\" or \"crisis\" — active incidents\n"
            "• \"advisories\" — current AI recommendations\n"
            "• \"hold <train id>\" — quick guidance to hold a train\n"
            "• \"sections\" — controller territory map"
        ),
        "chips": [],
    }


def _handle_status() -> dict:
    trains = _live_trains()
    crises = active_crises()
    advisories = _build_advisories()
    line = section_sim.line_name

    bullets = [
        f"Line: {line} ({len(section_sim.sections)} sections, {len(section_sim.line_order)} stations).",
        f"Trains on line: {len(trains)}.",
        f"Disaster mode: {'ACTIVE' if disaster_active() else 'normal'}.",
        f"Active crises: {len(crises)}.",
        f"Active advisories: {len(advisories)}.",
    ]
    if trains:
        decisions = _decision_map()
        blocked = [
            t["train_id"]
            for t in trains
            if decisions.get(t["train_id"], {}).get("allow_movement") is False
        ]
        if blocked:
            bullets.append(f"Held trains: {', '.join(blocked)}.")
    answer = "\n".join(bullets)
    chips = [
        {"label": f"{len(trains)} trains on line", "section": line},
    ]
    return {"answer": answer, "chips": chips}


def _handle_trains() -> dict:
    trains = _live_trains()
    if not trains:
        return {"answer": "No trains are currently on the line.", "chips": []}
    lines = []
    for t in trains:
        section = _section_of_block(t["block_id"])
        lines.append(
            f"• {t['train_id']} ({t['train_type']}) at {t['block_id']} "
            f"@{t['speed_kmph']} km/h — {section or 'unknown section'}"
        )
    answer = "\n".join(lines)
    chips = [
        {"label": f"{len(trains)} trains", "section": t["line_id"]}
        for t in trains[:6]
    ]
    return {"answer": answer, "chips": chips}


def _handle_disaster() -> dict:
    if disaster_active():
        crises = [c for c in active_crises() if c["is_disaster"]]
        if crises:
            head = crises[0]
            answer = (
                f"DISASTER MODE is ACTIVE ({head['severity']} {head['label']} at "
                f"{head['location']} declared {head['declared_at']}). "
                "All /decision runs will HOLD every train until the crisis is resolved."
            )
        else:
            answer = "Disaster mode is active (a disaster-class crisis is live)."
        return {
            "answer": answer,
            "chips": [
                {"label": f"{c['label']} @ {c['location']}", "section": c["severity"]}
                for c in crises
            ],
        }
    answer = "Disaster mode is normal. No line-wide emergency crisis is active."
    recent = [c for c in active_crises() if not c["is_disaster"]]
    if recent:
        answer += (
            f" Non-disaster incidents on file: "
            f"{', '.join(c['label'] + ' @ ' + c['location'] for c in recent)}."
        )
    return {"answer": answer, "chips": []}


def _handle_crisis() -> dict:
    crises = active_crises()
    if not crises:
        return {
            "answer": "No active crises. Line operating normally.",
            "chips": [],
        }
    lines = [
        f"• {c['id']} {c['label']} ({c['severity']}) at {c['station_name'] or c['location']} — "
        f"{c['description']} — declared {c['declared_at']}"
        for c in crises
    ]
    answer = "\n".join([f"Active crises ({len(crises)}):", *lines])
    chips = [
        {"label": c["label"], "section": c["severity"]}
        for c in crises[:6]
    ]
    return {"answer": answer, "chips": chips}


def _handle_advisories() -> dict:
    advisories = _build_advisories()
    if not advisories:
        return {
            "answer": "No active advisories right now. The section is running clear.",
            "chips": [],
        }
    lines = []
    for a in advisories:
        section = a.section_name or "unknown section"
        lines.append(
            f"• [{a.priority}] {a.title} @ {a.location} ({section}) — "
            f"trains: {', '.join(a.affected_trains)}. {', '.join(a.strategies) or 'monitor'}"
        )
    answer = "\n".join([f"Active advisories ({len(advisories)}):", *lines])
    chips = [
        {"label": f"[{a.priority}] {a.title}", "section": a.section_name or ""}
        for a in advisories[:6]
    ]
    return {"answer": answer, "chips": chips}


def _handle_sections() -> dict:
    sections = section_sim.sections
    lines = []
    for sec in sections:
        stations = ", ".join(sec["stations"])
        lines.append(
            f"• {sec['name']}: {stations} — controller {sec['controller_id']}"
        )
    answer = "\n".join([f"Line sections ({len(sections)}):", *lines])
    chips = [
        {"label": sec["name"], "section": sec["controller_id"]}
        for sec in sections[:6]
    ]
    return {"answer": answer, "chips": chips}


def _handle_hold(query: str) -> dict:
    match = re.search(r"hold\s+([\w-]+)", query, re.IGNORECASE)
    trains = _live_trains()
    if not match:
        return {
            "answer": (
                "To hold a concrete train, say e.g. \"hold 12602\". "
                "Currently on line: " + ", ".join(t["train_id"] for t in trains)
                or "no trains."
            ),
            "chips": [],
        }
    train_id = match.group(1)
    hits = [t for t in trains if train_id.lower() in t["train_id"].lower()]
    if not hits:
        return {
            "answer": (
                f"Train '{train_id}' is not on the line right now. "
                "On line: " + ", ".join(t["train_id"] for t in trains)
            ),
            "chips": [],
        }
    hit = hits[0]
    decisions = _decision_map()
    held = decisions.get(hit["train_id"], {}).get("allow_movement") is False
    status = "is currently HELD" if held else "is moving"
    answer = (
        f"{hit['train_id']} ({hit['train_type']}) is at {hit['block_id']} "
        f"@{hit['speed_kmph']} km/h and {status}. "
        "To hold it: Train Management → set the signal to RED for that block and "
        "run a decision, or declare a disaster-crisis to hold the whole line."
    )
    return {
        "answer": answer,
        "chips": [{"label": hit["train_id"], "section": hit["train_type"]}],
    }


def _handle_unknown(query: str) -> dict:
    trains = _live_trains()
    hints = []
    if trains:
        hints.append(
            '"trains" to see the live roster — '
            + ", ".join(t["train_id"] for t in trains[:5])
        )
    hints.append('"disaster" / "crisis" / "advisories" / "sections" / "status"')
    return {
        "answer": (
            f"I didn't catch that. I'm a line-state advisor, not a general chatbot. "
            "Try " + "; ".join(hints) + "."
        ),
        "chips": [],
    }


def answer_for(query: str) -> dict:
    """Route a controller query to the appropriate live-state handler."""
    q = query.strip()
    lowered = q.lower()

    if not q:
        return _handle_help()

    if any(k in lowered for k in ("help", "what can", "commands", "?")):
        result = _handle_help()
    elif any(k in lowered for k in ("hold", "stop ")):
        result = _handle_hold(q)
    elif any(k in lowered for k in ("disaster", "emergency")):
        result = _handle_disaster()
    elif any(k in lowered for k in ("crisis", "incident")):
        result = _handle_crisis()
    elif any(k in lowered for k in ("advis", "recommend", "suggest")):
        result = _handle_advisories()
    elif any(k in lowered for k in ("section", "territory")):
        result = _handle_sections()
    elif any(k in lowered for k in ("train", "roster", "move", "where")):
        result = _handle_trains()
    elif any(k in lowered for k in ("status", "overview", "line", "healthy")):
        result = _handle_status()
    else:
        result = _handle_unknown(q)

    record_action(
        "assistant_query",
        {"query": q, "intent": _intent_label(result.get("answer", ""))},
    )
    return result


def _intent_label(_answer: str) -> str:
    return "answered"


def quick_prompts() -> List[str]:
    return [
        "Status",
        "Trains on line",
        "Active crises",
        "Advisories",
        "Hold 12602",
        "Sections",
    ]