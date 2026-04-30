# Dyno entrypoint. The Node buildpack runs `heroku-postbuild` from the root
# package.json at slug compile time, producing frontend/dist/. The Python
# buildpack then installs requirements.txt and this web process starts
# FastAPI, which serves /api/* AND the built SPA (see backend/main.py).
web: gunicorn -w 1 -k uvicorn.workers.UvicornWorker backend.main:app --bind 0.0.0.0:$PORT --timeout 120 --preload
