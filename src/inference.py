import numpy as np
from PIL import Image
from io import BytesIO
from src.preprocess import preprocess_segmentation, preprocess_classification
from skimage.transform import resize
import cv2


# ─── Overlay constants ────────────────────────────────────────────────────────

FILL_COLOR   = (255, 220, 0)   # Warm yellow fill
BORDER_COLOR = (255, 140, 0)   # Orange-amber border (contrasts on fill)
FILL_ALPHA   = 0.35            # Fill transparency — image still clearly visible
BORDER_ALPHA = 0.90            # Border nearly opaque for sharp boundary


# ─── Mask post-processing ─────────────────────────────────────────────────────

def _clean_mask(binary_mask: np.ndarray) -> np.ndarray:
    """
    Post-process a raw binary segmentation mask to remove noise and
    smooth boundaries before overlaying on the image.

    Pipeline:
      1. Gaussian blur on the float mask → softens hard edges before re-threshold
      2. Morphological closing → fills small internal holes
      3. Morphological opening  → removes isolated noise blobs
      4. Keep only the largest connected component → eliminates stray fragments

    Args:
        binary_mask : (H, W) uint8 array with values 0 or 1

    Returns:
        np.ndarray : cleaned (H, W) uint8 mask
    """
    mask = binary_mask.astype(np.uint8)

    # ── Step 1: smooth float version, re-threshold ────────────────
    mask_f    = mask.astype(np.float32)
    mask_blur = cv2.GaussianBlur(mask_f, (21, 21), sigmaX=8, sigmaY=8)
    mask      = (mask_blur > 0.25).astype(np.uint8)

    # ── Step 2: closing — fill holes (kernel size scales with image) ──
    H, W    = mask.shape
    k_close = max(15, min(H, W) // 20)
    kernel_close = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (k_close, k_close)
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)

    # ── Step 3: opening — remove small blobs ─────────────────────
    k_open  = max(7, min(H, W) // 40)
    kernel_open = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (k_open, k_open)
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open, iterations=1)

    # ── Step 4: keep only the largest connected component ─────────
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        mask, connectivity=8
    )
    if num_labels > 1:
        # Component 0 is background; find the largest foreground component
        areas      = stats[1:, cv2.CC_STAT_AREA]
        largest_id = int(np.argmax(areas)) + 1
        mask       = (labels == largest_id).astype(np.uint8)

    return mask


# ─── Overlay rendering ────────────────────────────────────────────────────────

def overlay_mask_on_image(
    image: np.ndarray,
    predicted_mask: np.ndarray,
    alpha: float = FILL_ALPHA,
) -> BytesIO:
    """
    Render a tumour segmentation overlay on the original MRI image.

    Improvements over v1:
      - Semi-transparent yellow fill (alpha blend) instead of hard solid fill
      - Smooth contour border drawn on top for precise boundary
      - Mask cleaned with morphological ops before rendering

    Args:
        image          : (H, W, 3) uint8 RGB image
        predicted_mask : (H', W') or (H', W', 1) float/uint8 mask
        alpha          : Fill transparency (0 = invisible, 1 = opaque)

    Returns:
        BytesIO: JPEG-encoded overlaid image
    """
    H, W = image.shape[:2]

    # ── Resize mask to image dimensions (bilinear for smooth edges) ──
    mask_squeezed = np.squeeze(predicted_mask).astype(np.float32)
    resized_mask  = cv2.resize(mask_squeezed, (W, H), interpolation=cv2.INTER_LINEAR)
    binary_mask   = (resized_mask > 0.5).astype(np.uint8)

    # ── Clean the mask ────────────────────────────────────────────
    binary_mask = _clean_mask(binary_mask)

    if binary_mask.sum() == 0:
        print("[Overlay] Mask empty after cleaning — returning original image")
        buf = BytesIO()
        Image.fromarray(image).save(buf, format="JPEG", quality=95)
        buf.seek(0)
        return buf

    print(f"[Overlay] Active pixels after clean: "
          f"{binary_mask.sum()} / {binary_mask.size} "
          f"({100 * binary_mask.mean():.1f}%)")

    # ── Work in float32 for blending ──────────────────────────────
    canvas = image.astype(np.float32)

    # ── Layer 1: semi-transparent fill ────────────────────────────
    fill      = np.zeros_like(canvas)
    fill[binary_mask == 1] = FILL_COLOR

    mask_3ch  = binary_mask[:, :, np.newaxis].astype(np.float32)
    canvas    = canvas * (1 - mask_3ch * FILL_ALPHA) + fill * mask_3ch * FILL_ALPHA

    # ── Layer 2: contour border ───────────────────────────────────
    # Find contours on the cleaned binary mask
    contours, _ = cv2.findContours(
        binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE
    )

    # Draw thick border onto a separate layer, then alpha-blend it
    border_layer = np.zeros_like(canvas)
    cv2.drawContours(border_layer, contours, -1, BORDER_COLOR, thickness=3)

    border_mask_gray = cv2.drawContours(
        np.zeros((H, W), dtype=np.uint8), contours, -1, 255, thickness=3
    )
    border_mask_3ch  = border_mask_gray[:, :, np.newaxis].astype(np.float32) / 255.0

    canvas = (
        canvas * (1 - border_mask_3ch * BORDER_ALPHA)
        + border_layer * border_mask_3ch * BORDER_ALPHA
    )

    # ── Encode ────────────────────────────────────────────────────
    result = np.clip(canvas, 0, 255).astype(np.uint8)
    buf    = BytesIO()
    Image.fromarray(result).save(buf, format="JPEG", quality=95)
    buf.seek(0)

    return buf


# ─── Segmentation inference ───────────────────────────────────────────────────

def inference_segmentation_with_overlay(image: np.ndarray, seg_model) -> Image.Image:
    """
    Run the U-Net segmentation model and return the overlaid image.

    Thresholding strategy:
      - Use the top-15% percentile of activations as the threshold.
        This is more robust than mean+std when the model outputs a wide
        or narrow activation distribution.
      - Clamp between 0.15 and 0.85 to avoid all-on / all-off masks.

    Args:
        image     : (H, W, 3) uint8 RGB array
        seg_model : Loaded Keras segmentation model

    Returns:
        PIL.Image : Overlaid result image
    """
    preprocessed = preprocess_segmentation(image)
    prediction   = seg_model.predict(preprocessed)

    raw_mask = prediction[0]  # (H, W, 1) or (H, W)
    print(f"[Seg] Raw mask — min: {raw_mask.min():.4f}, "
          f"max: {raw_mask.max():.4f}, mean: {raw_mask.mean():.4f}")

    # ── Percentile threshold ──────────────────────────────────────
    threshold = float(np.percentile(raw_mask, 85))
    threshold = max(0.15, min(threshold, 0.85))
    print(f"[Seg] Threshold (85th pct): {threshold:.4f}")

    binary_mask = (raw_mask > threshold).astype(np.uint8)
    print(f"[Seg] Active pixels (pre-clean): "
          f"{binary_mask.sum()} ({100 * binary_mask.mean():.1f}%)")

    overlaid_buf = overlay_mask_on_image(image, binary_mask)
    return Image.open(overlaid_buf)


# ─── Classification inference ─────────────────────────────────────────────────

def inference_classification(image: np.ndarray, model_paths: list) -> np.ndarray:
    """
    Run both base classifiers and return stacked softmax predictions.

    Args:
        image       : (H, W, 3) uint8 RGB array
        model_paths : [resnet_path, custom_cnn_path]

    Returns:
        np.ndarray : (1, 8) combined predictions
    """
    from src.utils import load_local_model

    models = [load_local_model(p) for p in model_paths]
    preprocessed = preprocess_classification(image)

    predictions = [m.predict(preprocessed) for m in models]
    combined    = np.column_stack(predictions)

    print(f"[Cls] Combined predictions shape: {combined.shape}")
    return combined


# ─── Meta model ───────────────────────────────────────────────────────────────

def meta_pred(combined_preds: np.ndarray, meta_model) -> np.ndarray:
    """
    Run stacked base-model predictions through the meta ensemble model.

    Args:
        combined_preds : (1, 8) stacked softmax from both base models
        meta_model     : Loaded Keras meta model

    Returns:
        np.ndarray : (1,) predicted class indices
    """
    probs        = meta_model.predict(combined_preds)
    class_preds  = np.argmax(probs, axis=1)
    return class_preds