import os
from celery import Celery

# We grab the Redis URL from the environment (configured in docker-compose.yml)
# If it's not set, we default to localhost for testing outside of Docker.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize the Celery application
# 1st arg: The name of the main module
# broker: Where FastAPI sends the messages (the "inbox")
# backend: Where Celery leaves the results (the "outbox")
celery_app = Celery(
    "yolo_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['app.tasks']
)

# Optional but highly recommended configurations for clean JSON data passing
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # This ensures tasks aren't acknowledged until they actually finish running
    task_acks_late=True,
    # This limits how many tasks one worker grabs at a time
    worker_prefetch_multiplier=1
)