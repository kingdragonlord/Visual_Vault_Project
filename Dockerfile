# ═══════════════════════════════════════════════════════════════
# Stage 1: Build the Next.js frontend
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy package files first for layer caching
COPY frontend/package*.json ./
RUN npm ci

# Copy the rest of the frontend source
COPY frontend/ ./

# Set the API URL for the production build
# This should point to the public-facing FastAPI URL in cloud deployments.
# Override via --build-arg API_URL=https://your-api.com or docker-compose build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the static export → outputs to /frontend/out
RUN npm run build


# ═══════════════════════════════════════════════════════════════
# Stage 2: Python API + embedded static frontend
# ═══════════════════════════════════════════════════════════════
FROM python:3.12-slim

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies needed for computer vision (OpenCV/Pillow)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file first to leverage Docker cache
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY app/ app/
COPY models/ models/

# Copy the built Next.js static export from Stage 1
COPY --from=frontend-builder /frontend/out ./frontend/out

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]