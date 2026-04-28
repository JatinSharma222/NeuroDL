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
        # Step 1 — build a sub-model that outputs (conv_features, predictions)
        grad_model = _build_grad_model(model, layer_name)

        # Step 2 — record gradients of the predicted class score
        #           w.r.t. the target conv layer's output
        heatmap = _compute_heatmap(grad_model, img_array, class_idx)

        # Step 3 — upsample + colorise + blend onto original image
        overlay_b64 = _render_overlay(img_array, heatmap)

        return overlay_b64

    except Exception:
        print(f"[Grad-CAM] Generation failed:\n{traceback.format_exc()}")
        return None


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _build_grad_model(
    model: tf.keras.Model,
    layer_name: str,
) -> tf.keras.Model:
    """
    Build a sub-model with two outputs:
      1. Feature maps from the target conv layer
      2. Final softmax predictions

    Args:
        model      : Full classification model
        layer_name : Name of the conv layer to tap into

    Returns:
        tf.keras.Model with outputs [conv_outputs, predictions]

    Raises:
        ValueError: If layer_name is not found in the model
    """
    # ResNet50V2 is saved as a nested sub-model — look inside it
    try:
        resnet_submodel = model.get_layer("resnet50v2")
        conv_layer = resnet_submodel.get_layer(layer_name)
    except ValueError:
        # Fallback: try top-level layers (flat model)
        layer_names = [l.name for l in model.layers]
        if layer_name not in layer_names:
            raise ValueError(
                f"Layer '{layer_name}' not found in model or its sub-models. "
                f"Top-level layers: {layer_names}"
            )
        conv_layer = model.get_layer(layer_name)

    grad_model = tf.keras.Model(
        inputs  = model.inputs,
        outputs = [conv_layer.output, model.output],
    )
    return grad_model


def _compute_heatmap(
    grad_model: tf.keras.Model,
    img_array: np.ndarray,
    class_idx: int,
) -> np.ndarray:
    """
    Core Grad-CAM computation:
      1. Forward pass → get conv feature maps + predictions
      2. Compute gradient of class score w.r.t. feature maps
      3. Global-average-pool gradients → per-channel importance weights
      4. Weighted sum of feature maps → coarse localisation map
      5. ReLU → keep only positive activations
      6. Normalise to [0, 1]

    Args:
        grad_model : Sub-model with [conv_outputs, predictions] outputs
        img_array  : Preprocessed image tensor, shape (1, H, W, 3)
        class_idx  : Target class index for gradient computation

    Returns:
        np.ndarray: 2D heatmap normalised to [0, 1], shape (h, w)
    """
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        tape.watch(img_tensor)
        conv_outputs, predictions = grad_model(img_tensor, training=False)
        # Score for the predicted class (before softmax squeeze)
        class_score = predictions[:, class_idx]

    # Gradients of class score w.r.t. conv feature maps
    grads = tape.gradient(class_score, conv_outputs)  # (1, h, w, c)

    # Global average pooling over spatial dims → importance weights per channel
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))  # (c,)

    # Weight feature maps by importance and sum across channels
    conv_outputs = conv_outputs[0]                                # (h, w, c)
    heatmap      = conv_outputs @ pooled_grads[..., tf.newaxis]  # (h, w, 1)
    heatmap      = tf.squeeze(heatmap)                            # (h, w)

    # ReLU — only keep features that positively influence the class score
    heatmap = tf.maximum(heatmap, 0)

    # Normalise to [0, 1]
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