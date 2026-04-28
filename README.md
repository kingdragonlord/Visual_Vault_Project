# YOLOv8 Object Detection API

A fast, containerized REST API that exposes the YOLOv8 object detection model using FastAPI and PyTorch. This project demonstrates how to serve machine learning models for computer vision tasks with hardware acceleration (CUDA) support.

## Features
* FastAPI Backend: High-performance async web framework.
* YOLOv8 Nano: State-of-the-art, lightweight object detection.
* GPU Acceleration: Automatically detects and utilizes NVIDIA CUDA for lightning-fast inference.
* Dockerized: Fully containerized environment using a multi-stage Dockerfile and Docker Compose for easy deployment.

## Project Structure
## Project Structure

* yolo-api/ (Root Directory)
* app/
* api/ - API routing and endpoints.
* schemas/ - Pydantic data validation models.
* services/ - ML model lazy-loading and inference logic.
* models/ - Local storage for downloaded YOLO weights.
* Dockerfile - Container build instructions.
* docker-compose.yml - Container orchestration and GPU passthrough.
* requirements.txt - Python dependencies with CUDA index.

## How to Run Locally

Create and activate a Python 3.12 virtual environment.

Install the dependencies:
bash pip install -r requirements.txt 

Start the FastAPI server:
bash uvicorn app.main:app --reload 

Access the interactive API documentation at http://127.0.0.1:8000/docs.

## How to Run with Docker

This project includes a Docker Compose setup that automatically passes your NVIDIA GPU through to the container for accelerated inference.

Ensure Docker Desktop is running.

Build and start the container:
bash docker-compose up --build 

Access the API at http://127.0.0.1:8000/docs.

## API Endpoints

### 1. Health Check
* URL: /api/v1/health
* Method: GET
* Description: Verifies that the API is awake and the ML model is accessible.

### 2. Object Detection
* URL: /api/v1/predict
* Method: POST
* Description: Upload an image to receive bounding boxes, labels, and confidence scores for detected objects.

## Example Request & Response

Request (cURL):
bash curl -X 'POST' \ 'http://127.0.0.1:8000/api/v1/predict' \ -H 'accept: application/json' \ -H 'Content-Type: multipart/form-data' \ -F 'file=@my_dog.jpg;type=image/jpeg' 

Response (JSON):
json { "message": "Detection successful", "model_used": "yolov8n", "detections": [ { "label": "dog", "confidence": 0.89, "bbox": { "x1": 150.5, "y1": 85.2, "x2": 450.1, "y2": 380.9 } } ] } 