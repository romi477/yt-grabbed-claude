# yt-grabber

A web service for downloading YouTube videos/audio and transcribing them to text.

## Requirements

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/)

## Quick Start

```bash
cd project
docker compose up --build
```

- Frontend: http://localhost:80
- Backend API: http://localhost:8000

## Development (without Docker)

```bash
cd project/backend
uv venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
uv pip install -r requirements.txt
uvicorn main:app --reload
```

## Project Structure

```
project/
├── backend/      # FastAPI app (Python)
├── frontend/     # Vanilla HTML/CSS/JS
└── docker-compose.yml
```
