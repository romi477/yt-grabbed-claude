FROM python:3.12-slim

# Install system dependencies: ffmpeg (audio/video processing) + Node.js (yt-dlp JS runtime)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

# Copy source code
COPY . .

# Ensure data dirs exist
RUN mkdir -p data transcripts

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
