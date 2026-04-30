"""
Dev entry-point: uv run main.py

Loads .env before starting uvicorn so DATABASE_URL and ANTHROPIC_API_KEY
are in os.environ before backend modules are imported.
"""
from dotenv import load_dotenv

load_dotenv()

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
