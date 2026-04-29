"""
src/preprocess.py
─────────────────
Image preprocessing for NeuroDL v2.0.

Handles three input formats:
  - JPEG / PNG  — standard pipeline (unchanged from v1.0)
  - DICOM .dcm  — new in v2.0 (Upgrade 2)

Public functions:
  load_image(file_storage)          → np.ndarray (H, W, 3) uint8
  preprocess_classification(image)  → np.ndarray (1, 128, 128, 3) float32
  preprocess_segmentation(image)    → np.ndarray (1, 256, 256, 3) float32
  process_predictions(r, c)         → np.ndarray combined predictions
"""

import traceback

import numpy as np
import pydicom
from PIL import Image
from skimage.transform import resize


# ─── Constants ────────────────────────────────────────────────────────────────

CLASSIFICATION_SIZE = 128   # Must match training configuration
SEGMENTATION_SIZE   = 224   # Must match U-Net training configuration


# ─── Public API ───────────────────────────────────────────────────────────────

def load_image(file_storage) -> np.ndarray:
    """
    Unified image loader — auto-detects DICOM vs standard image format.

    Accepts a Flask FileStorage object directly from request.files.
    Returns a uint8 RGB numpy array ready for preprocessing.

    Args:
        file_storage : Flask FileStorage from request.files['image']

    Returns:
        np.ndarray: RGB image array, shape (H, W, 3), dtype uint8

    Raises:
        ValueError : If the file cannot be read or converted
    """
    filename = (file_storage.filename or "").lower()

    if filename.endswith(".dcm"):
        print(f"[Preprocess] DICOM file detected: {file_storage.filename}")
        return _load_dicom(file_storage)
    else:
        print(f"[Preprocess] Standard image detected: {file_storage.filename}")
        return _load_standard(file_storage)


def preprocess_classification(image: np.ndarray) -> np.ndarray:
    """
    Preprocess a single image for classification.

    Resizes to CLASSIFICATION_SIZE × CLASSIFICATION_SIZE, ensures 3 channels,
    normalises pixel values to [0, 1], and adds a batch dimension.

    Args:
        image : RGB image array, shape (H, W, 3), any dtype

    Returns:
        np.ndarray: shape (1, 128, 128, 3), float32, values in [0, 1]
    """
    img = resize(
        image,
        (CLASSIFICATION_SIZE, CLASSIFICATION_SIZE),
        mode="constant",
        preserve_range=True,
    )

    img = _ensure_rgb(img)
    img = img.astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)          # Add batch dimension

    print(f"[Preprocess] Classification ready — shape: {img.shape}")
    return img


def preprocess_segmentation(image: np.ndarray) -> np.ndarray:
    """
    Preprocess a single image for U-Net segmentation.

    Resizes to SEGMENTATION_SIZE × SEGMENTATION_SIZE, ensures 3 channels,
    normalises pixel values to [0, 1], and adds a batch dimension.

    Args:
        image : RGB image array, shape (H, W, 3), any dtype

    Returns:
        np.ndarray: shape (1, 256, 256, 3), float32, values in [0, 1]
    """
    print(f"[Preprocess] Original image shape: {image.shape}")

    img = resize(
        image,
        (SEGMENTATION_SIZE, SEGMENTATION_SIZE),
        mode="constant",
        preserve_range=True,
    )

    img = _ensure_rgb(img)
    img = img.astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)          # Add batch dimension

    print(f"[Preprocess] Segmentation ready — shape: {img.shape}")
    return img


def process_predictions(
    resnet_preds: np.ndarray,
    custom_preds: np.ndarray,
) -> np.ndarray:
    """
    Combine predictions from ResNet50V2 and Custom CNN for the Meta-Model.

    Args:
        resnet_preds : Shape (1, 4) softmax output from ResNet50V2
        custom_preds : Shape (1, 4) softmax output from Custom CNN

    Returns:
        np.ndarray: Shape (1, 8) combined predictions
    """
    combined = np.column_stack((resnet_preds, custom_preds))
    print(f"[Preprocess] Combined predictions shape: {combined.shape}")
    return combined


# ─── Private Loaders ──────────────────────────────────────────────────────────

def _load_standard(file_storage) -> np.ndarray:
    """
    Load a standard image file (JPEG, PNG, etc.) using Pillow.

    Args:
        file_storage : Flask FileStorage object

    Returns:
        np.ndarray: RGB uint8 array, shape (H, W, 3)

    Raises:
        ValueError: If the file cannot be opened as an image
    """
    try:
        image_bytes = file_storage.read()
        from io import BytesIO
        pil_image   = Image.open(BytesIO(image_bytes)).convert("RGB")
        return np.array(pil_image, dtype=np.uint8)
    except Exception as e:
        raise ValueError(f"Cannot read image file '{file_storage.filename}': {e}")


def _load_dicom(file_storage) -> np.ndarray:
    """
    Load a DICOM (.dcm) file and convert it to a uint8 RGB numpy array.

    DICOM Pipeline:
      1. Read raw pixel data via pydicom
      2. Apply RescaleSlope + RescaleIntercept metadata corrections
      3. Apply window-leveling (WindowCenter + WindowWidth) for brain tissue
      4. Clip and normalise to uint8 [0, 255]
      5. Convert grayscale → RGB (3-channel)

    Brain tissue defaults if DICOM metadata is missing:
      WindowCenter = 40  HU  (brain tissue midpoint)
      WindowWidth  = 400 HU  (covers brain parenchyma well)

    Args:
        file_storage : Flask FileStorage object with .dcm content

    Returns:
        np.ndarray: RGB uint8 array, shape (H, W, 3)

    Raises:
        ValueError: If the DICOM file cannot be parsed
    """
    try:
        import tempfile, os
        from io import BytesIO

        # pydicom needs a file path — write to a temp file
        image_bytes = file_storage.read()
        with tempfile.NamedTemporaryFile(suffix=".dcm", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            ds = pydicom.dcmread(tmp_path)
        finally:
            os.unlink(tmp_path)              # Always clean up temp file

        # ── Step 1: Raw pixel array ───────────────────────────────
        pixel_array = ds.pixel_array.astype(np.float32)
        print(f"[Preprocess/DICOM] Raw pixel array shape: {pixel_array.shape}, "
              f"range: [{pixel_array.min():.0f}, {pixel_array.max():.0f}]")

        # ── Step 2: Rescale (HU conversion) ──────────────────────
        slope     = float(getattr(ds, "RescaleSlope",     1))
        intercept = float(getattr(ds, "RescaleIntercept", 0))
        pixel_array = pixel_array * slope + intercept
        print(f"[Preprocess/DICOM] After HU rescale: "
              f"[{pixel_array.min():.0f}, {pixel_array.max():.0f}] HU")

        # ── Step 3: Window leveling ───────────────────────────────
        # Extract WindowCenter / WindowWidth — may be a list (multi-window DICOM)
        raw_center = getattr(ds, "WindowCenter", 40)
        raw_width  = getattr(ds, "WindowWidth",  400)

        center = float(raw_center[0]) if hasattr(raw_center, "__iter__") else float(raw_center)
        width  = float(raw_width[0])  if hasattr(raw_width,  "__iter__") else float(raw_width)

        lower = center - width / 2.0
        upper = center + width / 2.0
        print(f"[Preprocess/DICOM] Window: center={center}, width={width} "
              f"→ [{lower:.0f}, {upper:.0f}] HU")

        pixel_array = np.clip(pixel_array, lower, upper)

        # ── Step 4: Normalise to uint8 [0, 255] ──────────────────
        pixel_array = ((pixel_array - lower) / (upper - lower) * 255.0)
        pixel_array = np.clip(pixel_array, 0, 255).astype(np.uint8)

        # ── Step 5: Grayscale → RGB ───────────────────────────────
        if pixel_array.ndim == 2:
            # Standard single-slice grayscale DICOM
            rgb = np.stack([pixel_array] * 3, axis=-1)
        elif pixel_array.ndim == 3 and pixel_array.shape[2] == 3:
            # Already RGB (rare but possible)
            rgb = pixel_array
        elif pixel_array.ndim == 3:
            # Multi-frame DICOM — use middle frame
            mid = pixel_array.shape[0] // 2
            frame = pixel_array[mid]
            rgb = np.stack([frame] * 3, axis=-1)
            print(f"[Preprocess/DICOM] Multi-frame DICOM — using frame {mid}")
        else:
            raise ValueError(f"Unexpected DICOM pixel array shape: {pixel_array.shape}")

        print(f"[Preprocess/DICOM] Final RGB shape: {rgb.shape}")
        return rgb

    except pydicom.errors.InvalidDicomError:
        raise ValueError(
            f"'{file_storage.filename}' is not a valid DICOM file. "
            "Ensure the file has not been corrupted."
        )
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Failed to process DICOM file: {traceback.format_exc()}")


# ─── Shared Utility ───────────────────────────────────────────────────────────

def _ensure_rgb(img: np.ndarray) -> np.ndarray:
    """
    Ensure image has exactly 3 channels (RGB).

    Handles:
      - Grayscale (H, W)       → repeat channel 3 times
      - RGBA (H, W, 4)         → drop alpha channel
      - RGB (H, W, 3)          → pass through unchanged

    Args:
        img : Image array of any channel count

    Returns:
        np.ndarray: (H, W, 3) array
    """
    if img.ndim == 2:
        return np.stack([img] * 3, axis=-1)
    if img.ndim == 3 and img.shape[2] == 4:
        return img[:, :, :3]
    return img


# ─── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Running preprocess self-test...")

    # Standard image test
    sample = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
    out_c  = preprocess_classification(sample)
    out_s  = preprocess_segmentation(sample)

    assert out_c.shape == (1, 128, 128, 3), f"Classification shape wrong: {out_c.shape}"
    assert out_s.shape == (1, 256, 256, 3), f"Segmentation shape wrong: {out_s.shape}"
    assert out_c.max() <= 1.0 and out_c.min() >= 0.0, "Classification not normalised"
    assert out_s.max() <= 1.0 and out_s.min() >= 0.0, "Segmentation not normalised"

    # Grayscale handling test
    gray = np.random.randint(0, 255, (300, 300), dtype=np.uint8)
    out_g = preprocess_classification(gray)
    assert out_g.shape == (1, 128, 128, 3), f"Grayscale shape wrong: {out_g.shape}"

    print("✓ All self-tests passed")