
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

from backend.main import app

DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"

class ReactFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 404 and "." not in Path(path).name:
            return FileResponse(DIST / "index.html")
        return response

app.mount("/", ReactFiles(directory=str(DIST), html=True), name="frontend")
