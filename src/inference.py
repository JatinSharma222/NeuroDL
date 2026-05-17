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

def _clean_mask(
    binary_mask: np.ndarray,
    raw_scores: np.ndarray = None,
    gradcam_hint: np.ndarray = None,
) -> np.ndarray:
    """
    Post-process a raw binary segmentation mask to remove noise and
    smooth boundaries before overlaying on the image.

    Component selection priority:
      1. gradcam_hint  — pick the component whose centroid is closest to
                         the Grad-CAM peak activation. Most reliable because
                         the classifier already located the tumour spatially.
      2. raw_scores    — pick the component with highest mean model confidence.
      3. Fallback      — pick the largest area component.

    Args:
        binary_mask  : (H, W) uint8 array with values 0 or 1
        raw_scores   : (H, W) float32 raw model predictions
        gradcam_hint : (h, w) float32 Grad-CAM heatmap in [0, 1]

    Returns:
        np.ndarray : cleaned (H, W) uint8 mask
    """
    mask = binary_mask.astype(np.uint8)

    # ── Step 1: smooth float version, re-threshold ────────────────
    mask_f    = mask.astype(np.float32)
    mask_blur = cv2.GaussianBlur(mask_f, (21, 21), sigmaX=8, sigmaY=8)
    mask      = (mask_blur > 0.25).astype(np.uint8)

    # ── Step 2: closing — fill holes ─────────────────────────────
    H, W    = mask.shape
    k_close = max(15, min(H, W) // 20)
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_close, k_close))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)

    # ── Step 3: opening — remove small blobs ─────────────────────
    k_open = max(7, min(H, W) // 40)
    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_open, k_open))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open, iterations=1)

    # ── Step 4: component selection ──────────────────────────────
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask, connectivity=8
    )

    if num_labels <= 1:
        return mask

    # Minimum area: component must cover at least 0.5% of the image.
    # This eliminates tiny noise blobs and corner artifacts that slip
    # through morphological opening.
    min_area = int(H * W * 0.005)

    if gradcam_hint is not None:
        # ── Priority 1: closest centroid to Grad-CAM peak ─────────
        # The Grad-CAM heatmap encodes where the classifier focused.
        # Whichever segmentation component is nearest that peak is
        # almost certainly the actual tumour region.
        hint = cv2.resize(
            gradcam_hint.astype(np.float32), (W, H),
            interpolation=cv2.INTER_LINEAR,
        )
        peak_y, peak_x = np.unravel_index(np.argmax(hint), hint.shape)
        print(f"[CleanMask] GradCAM peak → ({peak_x}, {peak_y})")

        best_id   = 1
        best_dist = float("inf")
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area < min_area:
                print(f"[CleanMask] Component {i}: area={area} < min_area={min_area}, skipped")
                continue
            cx, cy = centroids[i]
            dist   = (cx - peak_x) ** 2 + (cy - peak_y) ** 2
            print(f"[CleanMask] Component {i}: centroid=({cx:.0f},{cy:.0f}), "
                  f"dist²={dist:.0f}, area={area}")
            if dist < best_dist:
                best_dist = dist
                best_id   = i

        print(f"[CleanMask] ✓ Selected component {best_id} by GradCAM proximity")
        mask = (labels == best_id).astype(np.uint8)

    elif raw_scores is not None:
        # ── Priority 2: highest mean model confidence ─────────────
        scores = raw_scores.astype(np.float32)
        if scores.shape != (H, W):
            scores = cv2.resize(scores, (W, H), interpolation=cv2.INTER_LINEAR)

        best_id    = 1
        best_score = -1.0
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area < min_area:
                print(f"[CleanMask] Component {i}: area={area} < min_area={min_area}, skipped")
                continue
            mean_score = float(scores[labels == i].mean())
            print(f"[CleanMask] Component {i}: mean_score={mean_score:.4f}, area={area}")
            if mean_score > best_score:
                best_score = mean_score
                best_id    = i

        print(f"[CleanMask] ✓ Selected component {best_id} by raw score")
        mask = (labels == best_id).astype(np.uint8)

    else:
        # ── Fallback: largest area above minimum size ─────────────
        best_id    = 1
        best_area  = 0
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area >= min_area and area > best_area:
                best_area = area
                best_id   = i
        mask = (labels == best_id).astype(np.uint8)

    return mask


# ─── Overlay rendering ────────────────────────────────────────────────────────

def overlay_mask_on_image(
    image: np.ndarray,
    predicted_mask: np.ndarray,
    alpha: float = FILL_ALPHA,
    raw_scores: np.ndarray = None,
    gradcam_hint: np.ndarray = None,
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
    binary_mask = _clean_mask(binary_mask, raw_scores=raw_scores, gradcam_hint=gradcam_hint)

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


# ─── Grad-CAM pseudo-segmentation ────────────────────────────────────────────

def gradcam_pseudo_segmentation(
    image: np.ndarray,
    heatmap: np.ndarray,
    top_percent: float = 20.0,
) -> BytesIO:
    """
    Create a tumour region overlay from the Grad-CAM heatmap.

    FIXES vs previous version:
      1. Border masking (10% margin) — skull edges and image corners are
         often bright in MRI and score highly in the top-20% threshold,
         producing corner artifacts. Tumours are never at the very edge
         of a skull MRI, so zeroing the border before thresholding is safe.

      2. gradcam_hint instead of raw_scores for component selection —
         raw_scores selected the component with the highest MEAN heatmap
         value. A small corner artifact with uniformly high values easily
         beats a larger diffuse tumour region. gradcam_hint selects the
         component whose centroid is CLOSEST TO THE HEATMAP PEAK, which
         is where the fine-tuned Grad-CAM actually points.

    Args:
        image       : (H, W, 3) uint8 RGB original image
        heatmap     : (h, w) float32 Grad-CAM heatmap, values in [0, 1]
        top_percent : Keep the top N% of activations (default 20%)

    Returns:
        BytesIO: JPEG-encoded overlaid image
    """
    H, W = image.shape[:2]

    # ── Resize heatmap to full image resolution ───────────────────
    hm = cv2.resize(heatmap.astype(np.float32), (W, H),
                    interpolation=cv2.INTER_CUBIC)
    hm = np.clip(hm, 0.0, 1.0)

    # ── Smooth to remove upsampling block artefacts ───────────────
    sigma = min(H, W) / 50
    k = int(sigma * 4) | 1
    hm = cv2.GaussianBlur(hm, (k, k), sigmaX=sigma, sigmaY=sigma)
    mx = hm.max()
    if mx > 0:
        hm = hm / mx

    # ── Border masking — zero out 10% margin ─────────────────────
    # Skull edges and image corners produce bright MRI intensities that
    # land in the top-20% threshold and become corner artifacts.
    # Brain tumours are never at the very image boundary.
    hm_masked = hm.copy()
    my = int(H * 0.10)
    mx_ = int(W * 0.10)
    hm_masked[:my,   :]  = 0   # top edge
    hm_masked[-my:,  :]  = 0   # bottom edge
    hm_masked[:,  :mx_]  = 0   # left edge
    hm_masked[:, -mx_:]  = 0   # right edge
    print(f"[PseudoSeg] Border masked (10% margin = {my}px × {mx_}px)")

    # ── Percentile threshold on border-masked heatmap ─────────────
    # Compute percentile on non-zero values so the zeroed border
    # doesn't push the threshold unrealistically low.
    nonzero = hm_masked[hm_masked > 0]
    if len(nonzero) > 0:
        threshold = np.percentile(nonzero, 100 - top_percent)
    else:
        threshold = np.percentile(hm_masked, 100 - top_percent)

    binary_mask = (hm_masked > threshold).astype(np.uint8)
    coverage = binary_mask.mean()
    print(f"[PseudoSeg] top {top_percent}% → threshold={threshold:.3f}, "
          f"coverage={coverage*100:.1f}%")

    # ── Component selection: peak proximity (gradcam_hint) ────────
    # Pass hm_masked as gradcam_hint so _clean_mask finds the heatmap
    # peak and selects the connected component whose centroid is closest.
    # This is correct: fine-tuned Grad-CAM peak = tumour location.
    # Do NOT pass raw_scores — mean score selects the brightest small
    # blob (corner artifact) rather than the correct tumour region.
    binary_mask = _clean_mask(binary_mask, gradcam_hint=hm_masked)

    print(f"[PseudoSeg] Final active pixels: "
          f"{binary_mask.sum()} ({100 * binary_mask.mean():.1f}%)")

    return overlay_mask_on_image(image, binary_mask)


# ─── Segmentation inference ───────────────────────────────────────────────────

def inference_segmentation_with_overlay(
    image: np.ndarray,
    seg_model,
    gradcam_hint: np.ndarray = None,
) -> Image.Image:
    """
    Run the U-Net segmentation model and return the overlaid image.

    Args:
        image        : (H, W, 3) uint8 RGB array
        seg_model    : Loaded Keras segmentation model
        gradcam_hint : Optional (h, w) float32 Grad-CAM heatmap.
                       When provided, the connected component closest to
                       the Grad-CAM peak is selected as the tumour region
                       instead of the largest or highest-confidence component.

    Returns:
        PIL.Image : Overlaid result image
    """
    preprocessed = preprocess_segmentation(image)
    prediction   = seg_model.predict(preprocessed)

    raw_mask = prediction[0]  # (H, W, 1) or (H, W)
    print(f"[Seg] Raw mask — min: {raw_mask.min():.4f}, "
          f"max: {raw_mask.max():.4f}, mean: {raw_mask.mean():.4f}")

    threshold = 0.5
    print(f"[Seg] Threshold: {threshold:.4f}")

    raw_mask_2d = np.squeeze(raw_mask).astype(np.float32)  # (H, W)
    binary_mask = (raw_mask_2d > threshold).astype(np.uint8)
    print(f"[Seg] Active pixels (pre-clean): "
          f"{binary_mask.sum()} ({100 * binary_mask.mean():.1f}%)")

    overlaid_buf = overlay_mask_on_image(
        image,
        binary_mask,
        raw_scores   = raw_mask_2d,
        gradcam_hint = gradcam_hint,
    )
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