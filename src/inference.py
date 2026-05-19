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
            cx, cy = centroids[i]
            dist   = (cx - peak_x) ** 2 + (cy - peak_y) ** 2
            area   = stats[i, cv2.CC_STAT_AREA]
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
            mean_score = float(scores[labels == i].mean())
            print(f"[CleanMask] Component {i}: mean_score={mean_score:.4f}")
            if mean_score > best_score:
                best_score = mean_score
                best_id    = i

        print(f"[CleanMask] ✓ Selected component {best_id} by raw score")
        mask = (labels == best_id).astype(np.uint8)

    else:
        # ── Fallback: largest area ────────────────────────────────
        areas      = stats[1:, cv2.CC_STAT_AREA]
        largest_id = int(np.argmax(areas)) + 1
        mask       = (labels == largest_id).astype(np.uint8)

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


# ─── Direct mask renderer (no _clean_mask re-selection) ──────────────────────

def _render_mask_overlay(image: np.ndarray, mask: np.ndarray) -> BytesIO:
    """
    Render a pre-selected binary mask onto the image directly.
    Does NOT call _clean_mask — mask is already the correct region.
    """
    H, W = image.shape[:2]

    if mask.sum() == 0:
        buf = BytesIO()
        Image.fromarray(image).save(buf, format="JPEG", quality=95)
        buf.seek(0)
        return buf

    canvas = image.astype(np.float32)

    # Semi-transparent yellow fill
    fill             = np.zeros_like(canvas)
    fill[mask == 1]  = FILL_COLOR
    mask_3ch         = mask[:, :, np.newaxis].astype(np.float32)
    canvas           = canvas * (1 - mask_3ch * FILL_ALPHA) + fill * mask_3ch * FILL_ALPHA

    # Orange border
    contours, _      = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    border_layer     = np.zeros_like(canvas)
    cv2.drawContours(border_layer, contours, -1, BORDER_COLOR, thickness=3)
    border_gray      = cv2.drawContours(
        np.zeros((H, W), dtype=np.uint8), contours, -1, 255, thickness=3
    )
    border_3ch       = border_gray[:, :, np.newaxis].astype(np.float32) / 255.0
    canvas           = (
        canvas * (1 - border_3ch * BORDER_ALPHA)
        + border_layer * border_3ch * BORDER_ALPHA
    )

    result = np.clip(canvas, 0, 255).astype(np.uint8)
    buf    = BytesIO()
    Image.fromarray(result).save(buf, format="JPEG", quality=95)
    buf.seek(0)
    return buf


# ─── Grad-CAM pseudo-segmentation ────────────────────────────────────────────

def gradcam_pseudo_segmentation(
    image: np.ndarray,
    heatmap: np.ndarray,
    top_percent: float = 10.0,
) -> BytesIO:
    """
    Create a tumour region overlay from the Grad-CAM heatmap.

    APPROACH — "contains peak pixel":
      1. Resize + smooth heatmap to original image resolution
      2. Zero out 10% border (eliminates skull/background artifacts)
      3. Threshold at top-N percentile (10% = focused, not diffuse)
      4. Select the connected component containing the peak pixel
      5. If component > 25% of image, tighten threshold and retry
      6. Light morphological closing (iterations=1) to fill holes
      7. Render via _render_mask_overlay (skips _clean_mask entirely)

    Key design decisions:
      - top_percent=10 (not 20): 20% creates regions large enough to
        span brain tissue AND facial structures in sagittal views.
        10% stays tightly focused around the true hotspot.
      - "contains peak pixel" beats centroid/mean-score: the blob that
        physically includes the Grad-CAM maximum IS the tumour region.
      - Area cap (25%): if the selected region is unreasonably large,
        tighten threshold until it's a plausible tumour size.
      - _render_mask_overlay: skips the _clean_mask inside
        overlay_mask_on_image which would redo component selection
        and potentially select the wrong component again.
    """
    H, W = image.shape[:2]

    # ── 1. Resize to full image resolution ───────────────────────
    hm = cv2.resize(heatmap.astype(np.float32), (W, H),
                    interpolation=cv2.INTER_CUBIC)
    hm = np.clip(hm, 0.0, 1.0)

    # ── 2. Smooth to remove upsampling block artefacts ────────────
    sigma = min(H, W) / 50
    k     = int(sigma * 4) | 1
    hm    = cv2.GaussianBlur(hm, (k, k), sigmaX=sigma, sigmaY=sigma)
    mx    = hm.max()
    if mx > 0:
        hm = hm / mx

    # ── 3. Zero out 10% border ────────────────────────────────────
    hm_masked      = hm.copy()
    by, bx         = int(H * 0.10), int(W * 0.10)
    hm_masked[:by,  :]  = 0
    hm_masked[-by:, :]  = 0
    hm_masked[:,  :bx]  = 0
    hm_masked[:, -bx:]  = 0

    # ── 4. Percentile threshold on non-zero region ────────────────
    nonzero = hm_masked[hm_masked > 0]
    if len(nonzero) == 0:
        hm_masked = hm.copy()
        nonzero   = hm_masked[hm_masked > 0]

    def _threshold_and_select(pct):
        """Return (selected_mask, area) for a given top_percent."""
        t           = np.percentile(nonzero, 100 - pct)
        bmask       = (hm_masked > t).astype(np.uint8)
        nl, lb, st, _ = cv2.connectedComponentsWithStats(bmask, connectivity=8)
        py, px      = np.unravel_index(np.argmax(hm_masked), hm_masked.shape)
        pl          = int(lb[py, px])
        if pl == 0 and nl > 1:
            pl = int(np.argmax(st[1:, cv2.CC_STAT_AREA])) + 1
        if pl == 0 or nl <= 1:
            return None, 0
        sel  = (lb == pl).astype(np.uint8)
        return sel, sel.sum()

    # Start at top_percent, tighten if region is too large (>25% image)
    max_area  = int(H * W * 0.25)
    sel_mask, area = _threshold_and_select(top_percent)

    if sel_mask is None:
        buf = BytesIO()
        Image.fromarray(image).save(buf, format="JPEG", quality=95)
        buf.seek(0)
        return buf

    if area > max_area:
        print(f"[PseudoSeg] Area {area/H/W*100:.1f}% too large, tightening...")
        for pct in [7.0, 5.0, 3.0]:
            m2, a2 = _threshold_and_select(pct)
            if m2 is not None and a2 <= max_area:
                sel_mask, area = m2, a2
                print(f"[PseudoSeg] Tightened to {pct}% → area={a2/H/W*100:.1f}%")
                break

    print(f"[PseudoSeg] Final area: {area} px ({area/H/W*100:.1f}%)")

    # ── 5. Light closing (iterations=1) ──────────────────────────
    k_close      = max(7, min(H, W) // 40)
    kernel       = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_close, k_close))
    sel_mask     = cv2.morphologyEx(sel_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    # ── 6. Render — bypass _clean_mask ───────────────────────────
    return _render_mask_overlay(image, sel_mask)


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