# VisualVault 
From a simple YOLOv8 wrapper to a full-scale, enterprise-grade AI engine.

VisualVault is not just another object detection script. It is a high-performance, containerized ML backend that orchestrates three completely different AI models—YOLOv8, OpenAI's CLIP, and Hugging Face's Stable Diffusion—into one seamless, asynchronous pipeline.

Whether you are hunting for objects in a photo, searching a massive gallery using pure natural language, or using generative AI to redraw reality, this backend handles the heavy lifting without breaking a sweat.

## 🧠 The Brains (Machine Learning)
* Object Detection: State-of-the-art YOLOv8 Nano for lightning-fast bounding boxes and labels.
* Semantic Search: Don't just search file names. Search concepts. Using OpenAI's CLIP, VisualVault understands the context of your images through zero-shot text-to-image math embeddings and cosine similarity.
* Generative Style Transfer: Redraw reality. Uses Stable Diffusion v1.5 and classic VGG-19 Gram Matrix optimization to restyle user uploads into gorgeous, stylized masterpieces.
* Color Math: Extracts dominant hex color palettes using K-Means clustering for dynamic frontend UI styling.

## ⚙️ The Muscle (Architecture)
* FastAPI & Asyncpg: Built for speed with a fully asynchronous Python web server and a persistent PostgreSQL database.
* Celery  Redis: Heavy GPU math doesn't block the web thread. Inference is offloaded to asynchronous background workers so the API remains lightning fast.
* Hardware Agnostic: Automatically detects NVIDIA CUDA, but gracefully falls back to the CPU to bypass cutting-edge architecture mismatches (like the RTX 5090 Blackwell PyTorch bug).

## 🛡️ The Shield (Production Polish)
* JWT Authentication: Bulletproof user registration and login flows.
* Rate Limiting: SlowAPI prevents spam and protects your hardware from abuse.
* Redis Caching: Lightning-fast database query caching to save compute cycles.
* Structured Logging: Structlog traces every millisecond of every request with unique tracking IDs.

## 📂 The Blueprint

```text
yolo-api/
├── app/
│   ├── api/          # Endpoints (auth, assets, search, analysis)
│   ├── middleware/   # Rate limiting (SlowAPI) and structured logging
│   ├── ml/           # The magic: CLIP, Stable Diffusion, and YOLO services
│   ├── services/     # Storage, Postgres, and Redis cache singletons
│   └── tasks.py      # Celery background workers
├── storage/uploads/  # Local file storage
└── docker-compose.yml
```

## 🚀 Quick Start
Fire up the entire infrastructure with just a few commands.

1. Boot the Infrastructure (PostgreSQL & Redis)
bash docker-compose up db redis -d 

2. Set Your Secrets (.env)
env DATABASE_URL=postgresqlasyncpg://yolo_user:yolo_password@localhost:5432/yolo_db REDIS_URL=redis://localhost:6379/0 SECRET_KEY=your_super_secret_jwt_key 

3. Ignite the Web Server & ML Worker
(Run these in two separate terminals inside your Python 3.12 virtual environment)
bash uvicorn app.main:app --reload 
powershell celery -A app.celery_worker.celery_app worker --loglevel=info -P threads 

## 🎯 The Arsenal (Key Endpoints)
Head over to http://127.0.0.1:8000/docs to play with the interactive Swagger UI.

* POST /api/v1/assets/upload: Drop an image here. The server instantly replies with a success ticket while Celery quietly hunts for objects and color palettes in the background.
* POST /api/v1/search/text: Ask the AI to find your photos using natural language (e.g., "a cyberpunk neon city" or "a grassy field").
* GET /api/v1/analysis/style/{asset_id}: Tell Stable Diffusion to redraw your photo in the style of Van Gogh, and watch the PNG image stream right back to your browser.