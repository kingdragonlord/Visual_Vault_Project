import io
import logging
import time
from dataclasses import dataclass
from PIL import Image
import numpy as np
import torch
from torchvision.models import vgg19, VGG19_Weights
import torch.nn.functional as F
import torch.optim as optim
from torchvision import transforms

# --- NEW: Hugging Face Diffusers ---
from diffusers import StableDiffusionImg2ImgPipeline

logger = logging.getLogger(__name__)

@dataclass
class StyleTransferResult:
    image_bytes: bytes
    content_size: tuple[int, int]
    style_name: str
    alpha: float
    inference_time_ms: float
    device: str

# Our new Hugging Face text-based generative style presets!
PRESET_STYLES = {
    "mosaic": {"name": "Mosaic", "prompt": "A beautiful mosaic artwork composed of colorful geometric tiles, highly detailed, masterpiece", "artist": "Abstract", "description": "Colorful geometric mosaic pattern"},
    "watercolor": {"name": "Watercolor", "prompt": "A beautiful watercolor painting, vibrant flowing colors, artistic brush strokes, masterpiece", "artist": "Abstract", "description": "Flowing artistic watercolor painting"},
    "cyberpunk": {"name": "Cyberpunk", "prompt": "Cyberpunk aesthetic, neon lighting, highly detailed futuristic digital art, retrowave", "artist": "Digital Art", "description": "Neon 80s futuristic vibes"},
    "van_gogh": {"name": "Van Gogh", "prompt": "An oil painting in the style of Vincent Van Gogh, swirling starry night brush strokes, masterpiece", "artist": "Vincent Van Gogh", "description": "Impressionist oil painting"},
}

class StyleTransferService:
    def __init__(self):
        self.device = None
        self.pipeline = None
        self._initialized = False

    def initialize(self) -> None:
        if self._initialized:
            return

        # --- TEMPORARY RTX 5090 FIX ---
        self.device = torch.device("cpu")
        logger.info("Forcing CPU for Style Transfer to bypass RTX 5090 mismatch")
        # ------------------------------

        logger.info("Loading Hugging Face Stable Diffusion pipeline...")
        
        # Load the Hugging Face Generative AI pipeline
        self.pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch.float32,
            safety_checker=None # Disabled to save memory/speed
        )
        self.pipeline = self.pipeline.to(self.device)

        self._initialized = True
        logger.info("Style Transfer service initialized")

    def _ensure_initialized(self):
        if not self._initialized:
            self.initialize()

    def _tensor_to_image(self, tensor: torch.Tensor) -> Image.Image:
        tensor = tensor.squeeze(0).cpu().clamp(0, 255)
        array = tensor.permute(1, 2, 0).numpy().astype(np.uint8)
        return Image.fromarray(array)

    def _load_image(self, source, max_size: int) -> torch.Tensor:
        if isinstance(source, Image.Image):
            image = source
        else:
            image = Image.open(source)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        w, h = image.size
        scale = max_size / max(w, h)
        if scale < 1:
            image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        transform = transforms.Compose([transforms.ToTensor(), transforms.Lambda(lambda x: x.mul(255))])
        return transform(image).unsqueeze(0).to(self.device)

    def transfer_preset(self, content, preset_name: str, alpha: float = 1.0, max_size: int = 512) -> StyleTransferResult:
        """Uses Hugging Face Generative AI (Stable Diffusion) to restyle the image!"""
        self._ensure_initialized()
        start_time = time.time()

        if preset_name not in PRESET_STYLES:
            raise ValueError(f"Unknown preset: {preset_name}")

        style_prompt = PRESET_STYLES[preset_name]["prompt"]

        if isinstance(content, bytes):
            content = Image.open(io.BytesIO(content))
        elif not isinstance(content, Image.Image):
            content = Image.open(content)

        if content.mode != 'RGB':
            content = content.convert('RGB')

        original_size = content.size
        # Diffusers needs dimensions to be multiples of 8. 512x512 is standard.
        content = content.resize((512, 512), Image.LANCZOS)

        # Strength determines how much to change the original image (0.1 = barely, 0.9 = completely)
        strength = max(0.1, min(0.95, alpha))

        # Run the Generative AI! We limit to 20 steps since we are forcing the CPU.
        result_image = self.pipeline(
            prompt=style_prompt,
            image=content,
            strength=strength,
            guidance_scale=7.5,
            num_inference_steps=20
        ).images[0]

        result_image = result_image.resize(original_size, Image.LANCZOS)

        buffer = io.BytesIO()
        result_image.save(buffer, format='PNG')

        return StyleTransferResult(
            image_bytes=buffer.getvalue(),
            content_size=original_size,
            style_name=PRESET_STYLES[preset_name]["name"],
            alpha=alpha,
            inference_time_ms=(time.time() - start_time) * 1000,
            device=str(self.device)
        )

    def transfer(self, content, style, alpha: float = 1.0, max_size: int = 512, num_steps: int = 50) -> StyleTransferResult:
        """The classic Gatys optimization approach for custom image uploads. Uses native PyTorch VGG19."""
        self._ensure_initialized()
        start_time = time.time()

        def gram_matrix(tensor: torch.Tensor) -> torch.Tensor:
            b, c, h, w = tensor.size()
            features = tensor.view(b, c, h * w)
            gram = torch.bmm(features, features.transpose(1, 2))
            return gram / (c * h * w)

        vgg = vgg19(weights=VGG19_Weights.IMAGENET1K_V1).features.to(self.device).eval()
        for param in vgg.parameters():
            param.requires_grad = False

        style_layers = [0, 5, 10, 19, 28]
        content_layer = 21

        def get_features(x, layers):
            features = []
            for i, layer in enumerate(vgg):
                x = layer(x)
                if i in layers:
                    features.append(x)
                if i == max(layers):
                    break
            return features

        mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1).to(self.device)
        std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1).to(self.device)

        content_tensor = self._load_image(content, max_size) / 255.0
        content_tensor = (content_tensor - mean) / std

        if isinstance(style, str):
            import httpx
            with httpx.Client() as client:
                resp = client.get(style)
                resp.raise_for_status()
                style_image = Image.open(io.BytesIO(resp.content))
        elif isinstance(style, Image.Image):
            style_image = style
        else:
            style_image = Image.open(style)

        style_tensor = self._load_image(style_image, max_size) / 255.0
        style_tensor = (style_tensor - mean) / std

        if style_tensor.shape[2:] != content_tensor.shape[2:]:
            style_tensor = F.interpolate(style_tensor, size=content_tensor.shape[2:], mode='bilinear', align_corners=False)

        content_size = (content_tensor.shape[3], content_tensor.shape[2])

        with torch.no_grad():
            content_features = get_features(content_tensor, [content_layer])
            style_features = get_features(style_tensor, style_layers)
            style_grams = [gram_matrix(f) for f in style_features]

        output = content_tensor.clone().requires_grad_(True)
        optimizer = optim.Adam([output], lr=0.03)

        for step in range(num_steps):
            optimizer.zero_grad()
            output_content = get_features(output, [content_layer])
            output_style = get_features(output, style_layers)

            content_loss = F.mse_loss(output_content[0], content_features[0])
            style_loss = 0
            for of, sg in zip(output_style, style_grams):
                style_loss += F.mse_loss(gram_matrix(of), sg)
            style_loss /= len(style_layers)

            loss = content_loss + 1e6 * alpha * style_loss
            loss.backward()
            optimizer.step()

        output = output * std + mean
        output = output.clamp(0, 1) * 255
        output_image = self._tensor_to_image(output.detach())

        buffer = io.BytesIO()
        output_image.save(buffer, format='PNG')

        return StyleTransferResult(
            image_bytes=buffer.getvalue(),
            content_size=content_size,
            style_name="custom",
            alpha=alpha,
            inference_time_ms=(time.time() - start_time) * 1000,
            device=str(self.device)
        )

# Create a Singleton instance
_style_service = None
def get_style_service() -> StyleTransferService:
    global _style_service
    if _style_service is None:
        _style_service = StyleTransferService()
    return _style_service