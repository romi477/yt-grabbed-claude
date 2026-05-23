from pathlib import Path

import whisper

from jobs import update_job

MODELS = ("tiny", "base", "small", "medium")
DEFAULT_MODEL = "base"


def transcribe(filepath: Path, model_name: str, job_id: str) -> str:
    """
    Transcribe an audio/video file to text using Whisper.

    Blocking call — intended to run inside a FastAPI BackgroundTask.
    model_name options: tiny | base | small | medium
    """
    if model_name not in MODELS:
        model_name = DEFAULT_MODEL

    update_job(job_id, status="running", progress=0)

    model = whisper.load_model(model_name)
    result = model.transcribe(str(filepath))

    update_job(job_id, status="done", progress=100, result=result["text"])
    return result["text"]
