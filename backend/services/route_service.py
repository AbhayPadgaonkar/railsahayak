import json
from pathlib import Path
from backend.domain.route_models import Route


class RouteService:
    def __init__(self, section_id: str):
        self.routes = {}
        self._load(section_id)

    def _load(self, section_id: str):
        path = Path(f"backend/config/routes/{section_id}.json")
        data = json.loads(path.read_text())
        if "routes" in data:
            for r in data["routes"]:
                key = (r["block_id"], r["line_id"])
                self.routes[key] = Route(**r)
            return

        for block in data.get("blocks", []):
            block_id = block.get("block_id")
            for line in block.get("lines", []):
                line_id = line.get("line_id")
                if block_id and line_id:
                    self.routes[(block_id, line_id)] = Route(
                        block_id=block_id,
                        line_id=line_id,
                        turnouts=line.get("turnouts", []),
                    )

    def get_turnouts(self, block_id, line_id):
        route = self.routes.get((block_id, line_id))
        return route.turnouts if route else []
