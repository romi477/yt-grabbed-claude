import uuid
from typing import Any

# In-memory job store: {job_id: {status, progress, result, error}}
_jobs: dict[str, dict[str, Any]] = {}


def create_job() -> str:
    """Create a new job and return its ID."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "pending",  # pending | running | done | error
        "progress": 0,
        "result": None,
        "error": None,
    }
    return job_id


def update_job(job_id: str, **kwargs: Any) -> None:
    """Patch any fields on an existing job."""
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def get_job(job_id: str) -> dict[str, Any] | None:
    """Return job state or None if not found."""
    return _jobs.get(job_id)
