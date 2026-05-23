from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import downloader
import jobs

app = FastAPI(title="yt-grabber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request models ---

class InfoRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    type: str       # "video" | "audio"
    quality: str = "best"


# --- Background task wrappers ---

def _run_download_video(url: str, quality: str, job_id: str):
    try:
        downloader.download_video(url, quality, job_id)
    except Exception as e:
        jobs.update_job(job_id, status="error", error=str(e))


def _run_download_audio(url: str, job_id: str):
    try:
        downloader.download_audio(url, job_id)
    except Exception as e:
        jobs.update_job(job_id, status="error", error=str(e))


# --- Part 1: Download endpoints ---

@app.post("/api/info")
def get_info(req: InfoRequest):
    """Return video metadata and available qualities without downloading."""
    try:
        return downloader.get_info(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/download")
def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Start a video or audio download job. Returns job_id for polling."""
    job_id = jobs.create_job()

    if req.type == "audio":
        background_tasks.add_task(_run_download_audio, req.url, job_id)
    else:
        background_tasks.add_task(_run_download_video, req.url, req.quality, job_id)

    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    """Poll the status of a download or transcription job."""
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/api/files")
def list_files():
    """List all files available in the data directory."""
    data_dir = Path("data")
    if not data_dir.exists():
        return []
    files = []
    for f in sorted(data_dir.iterdir()):
        if f.is_file():
            stat = f.stat()
            files.append({
                "name": f.name,
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })
    return files


@app.get("/api/files/{filename}")
def download_file(filename: str):
    """Serve a downloaded file as an attachment."""
    path = Path("data") / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)


# --- Static frontend (local dev without Docker) ---

_frontend = Path(__file__).parent.parent / "frontend"
if _frontend.exists():
    app.mount("/", StaticFiles(directory=str(_frontend), html=True), name="frontend")
