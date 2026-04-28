# Start with a lightweight Python 3.12 base image
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

# Install the Python dependencies. 
# Because we added the extra-index-url in the requirements file, 
# this will automatically pull the CUDA-enabled PyTorch!
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY app/ app/
COPY models/ models/

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]