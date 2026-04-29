"""
src/gradcam.py
──────────────
Grad-CAM heatmap generation for NeuroDL v2.0 (Upgrade 1).

Extracts gradients from ResNet50V2's final conv layer to produce a
jet-colormap heatmap overlay that visually explains WHY the model
predicted a given class.

Output: base64-encoded PNG string, ready to embed in JSON responses.
"""

import base64
import traceback
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
import tensorflow as tf
from PIL import Image


# ─── Constants ────────────────────────────────────────────────────────────────

# Final convolutional layer name in ResNet50V2
# Gradients are extracted here to produce the coarse localisation map
RESNET_LAST_CONV_LAYER = "conv5_block3_out"

# Blend weights for the final overlay
HEATMAP_ALPHA  = 0.6   # heatmap intensity
ORIGINAL_ALPHA = 0.4   # original image intensity


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_gradcam(
    model: tf.keras.Model,
    img_array: np.ndarray,
    class_idx: int,
    layer_name: str = RESNET_LAST_CONV_LAYER,
) -> Optional[str]:
    """
    Generate a Grad-CAM heatmap overlay for a given prediction.

    Args:
        model      : Loaded ResNet50V2 Keras model
        img_array  : Preprocessed image, shape (1, H, W, 3), values in [0, 1]
        class_idx  : Predicted class index (0–3)
        layer_name : Name of the target conv layer to extract gradients from

    Returns:
        Base64-encoded PNG string of the heatmap overlay,
        or None if generation fails (caller should handle gracefully).
    """
    try:
        # Step 1 — build conv extractor + return model components
        grad_model_tuple = _build_grad_model(model, layer_name)

        # Step 2 — record gradients of the predicted class score
        #           w.r.t. the target conv layer's output
        heatmap = _compute_heatmap(grad_model_tuple, img_array, class_idx, layer_name)

        # Step 3 — upsample + colorise + blend onto original image
        overlay_b64 = _render_overlay(img_array, heatmap)

        return overlay_b64

    except Exception:
        print(f"[Grad-CAM] Generation failed:\n{traceback.format_exc()}")
        return None


def generate_gradcam_segmentation(
    model: tf.keras.Model,
    img_array: np.ndarray,
    class_idx: int,
    original_image: np.ndarray,
    threshold: float = 0.5,
    layer_name: str = RESNET_LAST_CONV_LAYER,
) -> Optional[str]:
    """
    Generate a tumour segmentation overlay derived from the Grad-CAM heatmap.

    Pipeline:
      1. Compute Grad-CAM heatmap
      2. Upsample heatmap with bicubic interpolation (avoids blocky edges)
      3. Gaussian-smooth the float heatmap before thresholding
      4. Threshold → binary mask
      5. Morphological cleanup: closing (fill holes) → opening (remove noise)
         → keep only the largest connected component
      6. Semi-transparent yellow fill (35% alpha) — anatomy stays visible
      7. Orange contour border (3 px, 90% alpha) for a sharp boundary line
      8. Return base64 JPEG

    Args:
        model          : Loaded ResNet50V2 Keras model
        img_array      : Preprocessed image, shape (1, H, W, 3), values in [0, 1]
        class_idx      : Predicted class index (0–3)
        original_image : Original uint8 RGB array, shape (H, W, 3)
        threshold      : Heatmap activation threshold (default 0.5)
        layer_name     : Target conv layer name

    Returns:
        Base64-encoded JPEG string of the overlay, or None on failure.
    """
    try:
        # ── Step 1: compute raw heatmap ───────────────────────────
        grad_model_tuple = _build_grad_model(model, layer_name)
        heatmap = _compute_heatmap(grad_model_tuple, img_array, class_idx, layer_name)

        # ── Step 2: upsample heatmap to original image size ──────
        H, W = original_image.shape[:2]

        # INTER_LINEAR — no ringing, no overshoot beyond [0,1].
        # INTER_CUBIC overshoots when upscaling a tiny 7×7 conv map,
        # creating spuriously high values at image edges/corners that
        # consistently beat the percentile threshold → mask lands at edge.
        heatmap_resized = cv2.resize(
            heatmap, (W, H), interpolation=cv2.INTER_LINEAR
        )
        # Hard-clip: prevent any floating-point drift outside [0, 1]
        heatmap_resized = np.clip(heatmap_resized, 0.0, 1.0)

        # ── Step 3: zero-out image border (10 % margin) ───────────
        # Edge pixels of the upscaled heatmap are unreliable because the
        # conv layer has no context outside the brain region. Zeroing the
        # border ensures the threshold always picks interior brain tissue.
        margin_h = max(1, int(H * 0.10))
        margin_w = max(1, int(W * 0.10))
        heatmap_inner = heatmap_resized.copy()
        heatmap_inner[:margin_h, :]  = 0   # top
        heatmap_inner[-margin_h:, :] = 0   # bottom
        heatmap_inner[:, :margin_w]  = 0   # left
        heatmap_inner[:, -margin_w:] = 0   # right

        # ── Step 4: percentile threshold on the masked heatmap ────
        # Only consider interior (non-zero) pixels for the percentile
        # so the cutoff is not dragged down by the zeroed border.
        interior_vals = heatmap_inner[heatmap_inner > 0]
        if interior_vals.size == 0:
            print("[Grad-CAM Seg] No interior activations — falling back to full map")
            interior_vals = heatmap_resized.ravel()

        # top ~20 % of interior activation → focused mask on tumour core
        raw_cutoff = float(np.percentile(interior_vals, 80))
        print(f"[Grad-CAM Seg] 80th-pct cutoff (interior) = {raw_cutoff:.4f}")

        # ── Step 5: gentle blur for smooth edges, then threshold ──
        sigma          = max(H, W) / 120
        k              = int(sigma * 4) | 1
        heatmap_smooth = cv2.GaussianBlur(
            heatmap_inner, (k, k), sigmaX=sigma, sigmaY=sigma
        )
        binary_mask = (heatmap_smooth >= raw_cutoff).astype(np.uint8)

        print(f"[Grad-CAM Seg] active after threshold: "
              f"{binary_mask.sum()} px ({100*binary_mask.mean():.1f}%)")

        # ── Step 5: morphological cleanup ────────────────────────

        # 5a. Closing — fill internal holes
        k_close = max(15, min(H, W) // 20)
        kernel_close = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (k_close, k_close)
        )
        binary_mask = cv2.morphologyEx(
            binary_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2
        )

        # 5b. Opening — remove isolated noise blobs
        k_open = max(7, min(H, W) // 40)
        kernel_open = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (k_open, k_open)
        )
        binary_mask = cv2.morphologyEx(
            binary_mask, cv2.MORPH_OPEN, kernel_open, iterations=1
        )

        # 5c. Keep only the largest connected component
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            binary_mask, connectivity=8
        )
        if num_labels > 1:
            areas      = stats[1:, cv2.CC_STAT_AREA]
            largest_id = int(np.argmax(areas)) + 1
            binary_mask = (labels == largest_id).astype(np.uint8)

        if binary_mask.sum() == 0:
            print("[Grad-CAM Seg] Mask empty after cleanup — returning None")
            return None

        print(f"[Grad-CAM Seg] Active after cleanup: "
              f"{binary_mask.sum()} px ({100*binary_mask.mean():.1f}%)")

        # ── Step 6: semi-transparent yellow fill ─────────────────
        canvas   = original_image.astype(np.float32)
        mask_3ch = binary_mask[:, :, np.newaxis].astype(np.float32)

        fill           = np.zeros_like(canvas)
        fill[binary_mask == 1] = [255, 220, 0]   # warm yellow

        FILL_ALPHA = 0.38
        canvas = canvas * (1 - mask_3ch * FILL_ALPHA) + fill * mask_3ch * FILL_ALPHA

        # ── Step 7: orange contour border ────────────────────────
        contours, _ = cv2.findContours(
            binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE
        )

        border_layer     = np.zeros_like(canvas)
        border_mask_gray = np.zeros((H, W), dtype=np.uint8)

        cv2.drawContours(border_layer,     contours, -1, (255, 140, 0), thickness=3)
        cv2.drawContours(border_mask_gray, contours, -1, 255,           thickness=3)

        border_3ch = border_mask_gray[:, :, np.newaxis].astype(np.float32) / 255.0

        BORDER_ALPHA = 0.90
        canvas = (
            canvas * (1 - border_3ch * BORDER_ALPHA)
            + border_layer * border_3ch * BORDER_ALPHA
        )

        # ── Step 8: encode ────────────────────────────────────────
        result    = np.clip(canvas, 0, 255).astype(np.uint8)
        pil_image = Image.fromarray(result)
        buffer    = BytesIO()
        pil_image.save(buffer, format="JPEG", quality=95)
        buffer.seek(0)

        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    except Exception:
        print(f"[Grad-CAM Seg] Generation failed:\n{traceback.format_exc()}")
        return None


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _build_grad_model(
    model: tf.keras.Model,
    layer_name: str,
) -> tuple:
    """
    Build a conv extractor sub-model and return it alongside the full model.

    Keras 3 Sequential models don't expose .output symbolically, so we
    can't use tf.keras.Model(inputs=model.inputs, outputs=[..., model.output]).
    Instead we:
      1. Build a functional extractor: resnet_input → conv_layer_output
      2. Return the extractor + full model so _compute_heatmap can manually
         complete the forward pass inside the GradientTape.

    Args:
        model      : Full Sequential classification model
        layer_name : Name of the target conv layer inside ResNet50V2

    Returns:
        tuple: (conv_extractor, resnet_submodel, model)
            conv_extractor   — functional model: input → conv_layer output
            resnet_submodel  — the ResNet50V2 sub-model
            model            — original full model (Sequential)

    Raises:
        ValueError: If ResNet50V2 submodel or layer_name not found
    """
    # Find the ResNet50V2 submodel inside the Sequential wrapper
    resnet_submodel = None
    for layer in model.layers:
        if "resnet50v2" in layer.name.lower():
            resnet_submodel = layer
            break

    if resnet_submodel is None:
        raise ValueError(
            "Could not find ResNet50V2 submodel inside the Sequential model. "
            f"Available layers: {[l.name for l in model.layers]}"
        )

    # Get the target conv layer from inside resnet
    try:
        conv_layer = resnet_submodel.get_layer(layer_name)
    except ValueError:
        available = [l.name for l in resnet_submodel.layers if "conv" in l.name.lower()]
        raise ValueError(
            f"Layer '{layer_name}' not found inside ResNet50V2. "
            f"Available conv layers: {available}"
        )

    # Functional extractor: resnet_input → conv_layer_output
    # This works because resnet_submodel IS a functional model
    conv_extractor = tf.keras.Model(
        inputs  = resnet_submodel.input,
        outputs = conv_layer.output,
        name    = "conv_extractor",
    )

    return conv_extractor, resnet_submodel, model


def _compute_heatmap(
    grad_model_tuple: tuple,
    img_array: np.ndarray,
    class_idx: int,
    layer_name: str,
) -> np.ndarray:
    """
    Core Grad-CAM computation — Keras 3 Sequential compatible.

    Strategy (avoids model.output issue):
      1. Extract conv_outputs using conv_extractor functional model
      2. Watch conv_outputs inside GradientTape
      3. Manually complete forward pass through remaining resnet layers
         then through remaining Sequential layers — all inside the tape
      4. Compute gradient of class_score w.r.t. conv_outputs
      5. Pool gradients → weighted feature map → ReLU → normalise

    Args:
        grad_model_tuple : (conv_extractor, resnet_submodel, model)
        img_array        : Preprocessed image, shape (1, H, W, 3)
        class_idx        : Target class index
        layer_name       : Name of the conv layer (to find its position)

    Returns:
        np.ndarray: 2D heatmap normalised to [0, 1], shape (h, w)
    """
    conv_extractor, resnet_submodel, model = grad_model_tuple
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        # ── Step 1: get conv outputs and watch them ───────────────
        conv_outputs = conv_extractor(img_tensor, training=False)
        tape.watch(conv_outputs)

        # ── Step 2: complete forward pass manually ────────────────
        # Find position of target layer in resnet and continue from there
        resnet_layers = resnet_submodel.layers
        conv_idx = next(
            i for i, l in enumerate(resnet_layers) if l.name == layer_name
        )

        x = conv_outputs
        for layer in resnet_layers[conv_idx + 1:]:
            x = layer(x, training=False)

        # Continue through Sequential layers after the resnet submodel
        # (GlobalAveragePooling2D, BatchNorm, Dense, Dropout, Dense)
        sequential_layers = model.layers
        resnet_layer_idx = next(
            i for i, l in enumerate(sequential_layers)
            if "resnet50v2" in l.name.lower()
        )
        for layer in sequential_layers[resnet_layer_idx + 1:]:
            x = layer(x, training=False)

        predictions = x                        # (1, num_classes)
        class_score = predictions[:, class_idx]

    # ── Step 3: gradients of class score w.r.t. conv outputs ─────
    grads = tape.gradient(class_score, conv_outputs)   # (1, h, w, c)

    if grads is None:
        raise RuntimeError(
            "GradientTape returned None — gradients could not be computed. "
            "Ensure the model layers are not frozen during inference."
        )

    # ── Step 4: pool → weight → sum ──────────────────────────────
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))   # (c,)
    conv_outputs = conv_outputs[0]                          # (h, w, c)
    heatmap      = conv_outputs @ pooled_grads[..., tf.newaxis]  # (h, w, 1)
    heatmap      = tf.squeeze(heatmap)                      # (h, w)

    # ── Step 5: ReLU + normalise ──────────────────────────────────
    heatmap    = tf.maximum(heatmap, 0)
    heatmap_np = heatmap.numpy()
    max_val    = heatmap_np.max()
    if max_val > 0:
        heatmap_np = heatmap_np / max_val

    return heatmap_np.astype(np.float32)


def _render_overlay(
    img_array: np.ndarray,
    heatmap: np.ndarray,
) -> str:
    """
    Convert the raw heatmap into a coloured overlay on the original image
    and return it as a base64-encoded PNG.

    Steps:
      1. Scale heatmap to uint8 [0, 255]
      2. Apply COLORMAP_JET (blue → green → red)
      3. Resize jet heatmap to match original image dimensions
      4. Alpha-blend heatmap over original image
      5. Encode as PNG → base64 string

    Args:
        img_array : Preprocessed image tensor, shape (1, H, W, 3), [0, 1]
        heatmap   : 2D normalised heatmap, shape (h, w), [0, 1]

    Returns:
        str: Base64-encoded PNG of the blended overlay
    """
    # ── Recover original image as uint8 ──────────────────────────
    original = np.uint8(img_array[0] * 255)          # (H, W, 3) RGB
    H, W     = original.shape[:2]

    # ── Jet colormap on heatmap ───────────────────────────────────
    heatmap_uint8 = np.uint8(255 * heatmap)          # (h, w)
    jet_heatmap   = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)  # BGR
    jet_heatmap   = cv2.cvtColor(jet_heatmap, cv2.COLOR_BGR2RGB)        # → RGB

    # ── Resize jet heatmap to match original resolution ───────────
    jet_resized = cv2.resize(jet_heatmap, (W, H))    # (H, W, 3)

    # ── Alpha blend ───────────────────────────────────────────────
    overlay = (
        HEATMAP_ALPHA  * jet_resized.astype(np.float32) +
        ORIGINAL_ALPHA * original.astype(np.float32)
    )
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)

    # ── Encode as base64 PNG ──────────────────────────────────────
    pil_image = Image.fromarray(overlay)
    buffer    = BytesIO()
    pil_image.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")