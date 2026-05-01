import io
import numpy as np
from typing import BinaryIO
from PIL import Image
from collections import Counter
from sklearn.cluster import KMeans

def get_image_dimensions(file: BinaryIO) -> tuple[int, int] | None:
    """Get the width and height of an image without permanently altering the file read position."""
    try:
        pos = file.tell()
        img = Image.open(file)
        dimensions = img.size
        file.seek(pos)
        return dimensions
    except Exception:
        file.seek(0)
        return None

def validate_image_integrity(file: BinaryIO) -> tuple[bool, str]:
    """
    Security Check: Validate that a file is a valid, uncorrupted image.
    The verify() method checks integrity without fully decoding the image data.
    """
    try:
        pos = file.tell()
        img = Image.open(file)
        img.verify()  # Check for corruption
        file.seek(pos)
        return True, ""
    except Image.UnidentifiedImageError:
        file.seek(0)
        return False, "File is not a recognized image format"
    except Image.DecompressionBombError:
        file.seek(0)
        return False, "Image is too large (possible decompression bomb)"
    except Exception as e:
        file.seek(0)
        return False, f"Invalid or corrupted image: {str(e)}"

def extract_dominant_colors(file: BinaryIO, num_colors: int = 5) -> list[dict]:
    """Extract the dominant color palette from an image using quantization."""
    pos = file.tell()
    img = Image.open(file)

    # Shrink the image significantly so color extraction is lightning fast
    img.thumbnail((150, 150))
    if img.mode != "RGB":
        img = img.convert("RGB")

    # Quantize to reduce colors to our target number
    quantized = img.quantize(colors=num_colors)
    palette = quantized.getpalette()

    # Count pixels per color
    pixels = list(quantized.getdata())
    color_counts = Counter(pixels)
    total = len(pixels)

    colors = []
    for idx, count in color_counts.most_common(num_colors):
        if palette:
            r = palette[idx * 3]
            g = palette[idx * 3 + 1]
            b = palette[idx * 3 + 2]
            colors.append({
                "hex": f"#{r:02x}{g:02x}{b:02x}",
                "rgb": [r, g, b],
                "percentage": round((count / total) * 100, 2),
            })

    file.seek(pos)
    return colors

def color_segment_image(file: BinaryIO, num_clusters: int = 5, output_format: str = "PNG") -> tuple[bytes, list[dict]]:
    """Segment an image by color using k-means clustering. Creates a cool posterized effect."""
    pos = file.tell()
    img = Image.open(file)
    if img.mode != "RGB":
        img = img.convert("RGB")

    img_array = np.array(img)
    original_shape = img_array.shape
    pixels = img_array.reshape(-1, 3)

    # Apply k-means clustering
    kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(pixels)
    centers = kmeans.cluster_centers_.astype(np.uint8)

    segmented_pixels = centers[labels]
    segmented_array = segmented_pixels.reshape(original_shape)
    segmented_img = Image.fromarray(segmented_array)

    unique, counts = np.unique(labels, return_counts=True)
    total_pixels = len(labels)

    cluster_colors = []
    for cluster_idx in range(num_clusters):
        r, g, b = centers[cluster_idx]
        count = counts[unique == cluster_idx][0] if cluster_idx in unique else 0
        percentage = (count / total_pixels) * 100
        cluster_colors.append({
            "cluster": cluster_idx,
            "hex": f"#{r:02x}{g:02x}{b:02x}",
            "rgb": [int(r), int(g), int(b)],
            "percentage": round(percentage, 2),
            "pixel_count": int(count),
        })

    cluster_colors.sort(key=lambda x: x["percentage"], reverse=True)

    output = io.BytesIO()
    save_kwargs = {"format": output_format}
    if output_format == "JPEG":
        save_kwargs["quality"] = 90

    segmented_img.save(output, **save_kwargs)
    file.seek(pos)

    return output.getvalue(), cluster_colors