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

        for r in data["routes"]:
            key = (r["block_id"], r["line_id"])
            self.routes[key] = Route(**r)

    def get_turnouts(self, block_id, line_id):
        route = self.routes.get((block_id, line_id))
        return route.turnouts if route else []
