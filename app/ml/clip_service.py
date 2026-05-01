import logging
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

logger = logging.getLogger(__name__)

class CLIPService:
    """Service for generating CLIP embeddings for Semantic Search."""

    def __init__(self):
        self.model = None
        self.processor = None
        self.device = None
        self._initialized = False

    def initialize(self) -> None:
        """Load the CLIP model and processor. Called lazily to save RAM."""
        if self._initialized:
            return

        model_name = "openai/clip-vit-base-patch32"
        logger.info(f"Loading CLIP model: {model_name}")

        # Determine device (Graceful fallback to CPU if the RTX 5090 acts up)
        # if torch.cuda.is_available():
        self.device = torch.device("cpu")
        logger.info("Forcing CPU for CLIP inference to bypass RTX 5090 mismatch")
    #        self.device = torch.device("cuda")
    #        logger.info("Using CUDA for CLIP inference")
    #    else:
    #        self.device = torch.device("cpu")
    #        logger.info("Using CPU for CLIP inference")

        # Load model and processor
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model = CLIPModel.from_pretrained(
            model_name,
            torch_dtype=torch.float32,
            use_safetensors=True,
        )
        self.model.to(self.device)
        self.model.eval()  # Set to evaluation mode

        self._initialized = True
        logger.info("CLIP model loaded successfully")

    def ensure_initialized(self) -> None:
        if not self._initialized:
            self.initialize()

    def get_image_embedding(self, image: Image.Image) -> np.ndarray:
        """Generate a normalized 512-dimensional embedding for an image."""
        self.ensure_initialized()

        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Generate embedding
        with torch.no_grad():
            image_features = self.model.get_image_features(**inputs)

        if hasattr(image_features, 'pooler_output'):
            image_features = image_features.pooler_output
        elif hasattr(image_features, 'last_hidden_state'):
            image_features = image_features.last_hidden_state[:, 0, :]

        # Normalize the embedding so dot product = cosine similarity
        embedding = image_features.cpu().numpy()[0]
        embedding = embedding / np.linalg.norm(embedding)

        return embedding

    def get_text_embedding(self, text: str) -> np.ndarray:
        """Generate a normalized embedding for a text search query."""
        self.ensure_initialized()

        inputs = self.processor(text=[text], return_tensors="pt", padding=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            text_features = self.model.get_text_features(**inputs)

        if hasattr(text_features, 'pooler_output'):
            text_features = text_features.pooler_output
        elif hasattr(text_features, 'last_hidden_state'):
            text_features = text_features.last_hidden_state[:, 0, :]

        embedding = text_features.cpu().numpy()[0]
        embedding = embedding / np.linalg.norm(embedding)

        return embedding

    def classify_image(self, image: Image.Image, labels: list[str]) -> list[tuple[str, float]]:
        """Zero-shot image classification against a custom list of labels."""
        self.ensure_initialized()

        prompts = [f"a photo of {label}" for label in labels]
        
        image_inputs = self.processor(images=image, return_tensors="pt")
        image_inputs = {k: v.to(self.device) for k, v in image_inputs.items()}

        text_inputs = self.processor(text=prompts, return_tensors="pt", padding=True)
        text_inputs = {k: v.to(self.device) for k, v in text_inputs.items()}

        with torch.no_grad():
            image_features = self.model.get_image_features(**image_inputs)
            text_features = self.model.get_text_features(**text_inputs)

            if hasattr(image_features, 'pooler_output'):
                image_features = image_features.pooler_output
            elif hasattr(image_features, 'last_hidden_state'):
                image_features = image_features.last_hidden_state[:, 0, :]

            if hasattr(text_features, 'pooler_output'):
                text_features = text_features.pooler_output
            elif hasattr(text_features, 'last_hidden_state'):
                text_features = text_features.last_hidden_state[:, 0, :]

            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            similarities = (image_features @ text_features.T).squeeze(0)
            probs = torch.softmax(similarities * 100, dim=0)

        results = list(zip(labels, probs.cpu().numpy().tolist()))
        results.sort(key=lambda x: x[1], reverse=True)
        return results

# Create a Singleton instance
_clip_service = None

def get_clip_service() -> CLIPService:
    global _clip_service
    if _clip_service is None:
        _clip_service = CLIPService()
    return _clip_service