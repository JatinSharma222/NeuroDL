"""
src/gradcam.py
──────────────
Grad-CAM heatmap generation for NeuroDL v2.0.

Extracts gradients from ResNet50V2's final conv layer to produce a
jet-colormap heatmap overlay that visually explains WHY the model
predicted a given class.

Output: base64-encoded PNG string, ready to embed in JSON responses.

This module is responsible ONLY for the visual explanation heatmap.
Tumour segmentation (pixel-level boundary detection) is handled
separately by the U-Net model in src/inference.py.
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

# Target convolutional layer for Grad-CAM.
#
# At 224×224 input, spatial resolution per layer:
#   conv5_block3_out  →  7×7   ← USE THIS (semantic + reasonable resolution)
#   conv4_block6_out  →  14×14 (more spatial but less semantic)
#
# 7×7 gives 49 cells, each covering 32×32px of the 224px image.
# This is the standard Grad-CAM target for ResNet50V2 at ImageNet resolution.
RESNET_LAST_CONV_LAYER = "conv5_block3_out"

# Blend weights: 0.55 heatmap / 0.45 original keeps brain anatomy visible.
HEATMAP_ALPHA  = 0.55
ORIGINAL_ALPHA = 0.45


# ─── Public API ───────────────────────────────────────────────────────────────

def get_gradcam_heatmap(
    model: tf.keras.Model,
    img_array: np.ndarray,
    class_idx: int,
    layer_name: str = RESNET_LAST_CONV_LAYER,
) -> Optional[np.ndarray]:
    """
    Return the raw 2D Grad-CAM heatmap (H, W) float32 normalised to [0, 1].

    This is a lightweight version of generate_gradcam that skips the overlay
    rendering step. Used externally to guide segmentation component selection —
    the heatmap peak tells us where the classifier found the tumour, so the
    segmentation can prioritise the closest connected component.

    Args:
        model      : Loaded ResNet50V2 Keras model
        img_array  : Preprocessed image (1, H, W, 3) float32
        class_idx  : Predicted class index
        layer_name : Target conv layer name

    Returns:
        np.ndarray (H, W) float32 in [0, 1], or None if computation fails.
    """
    try:
        grad_model_tuple = _build_grad_model(model, layer_name)
        return _compute_heatmap(grad_model_tuple, img_array, class_idx, layer_name)
    except Exception:
        print(f"[Grad-CAM] Heatmap extraction failed:\n{traceback.format_exc()}")
        return None


def generate_gradcam(
    model: tf.keras.Model,
    img_array: np.ndarray,
    class_idx: int,
    original_image: np.ndarray = None,
    layer_name: str = RESNET_LAST_CONV_LAYER,
) -> Optional[str]:
    """
    Generate a Grad-CAM heatmap overlay for a given prediction.

    The heatmap is rendered on top of original_image when provided,
    giving a full-resolution output instead of the 128x128 preprocessed copy.

    Args:
        model          : Loaded ResNet50V2 Keras model
        img_array      : Preprocessed image, shape (1, H, W, 3), values in [0, 1]
        class_idx      : Predicted class index (0-3)
        original_image : Optional full-resolution uint8 RGB array (H, W, 3).
                         When provided the heatmap is rendered on the original
                         scan instead of the small preprocessed copy.
        layer_name     : Name of the target conv layer to extract gradients from

    Returns:
        Base64-encoded PNG string of the heatmap overlay,
        or None if generation fails.
    """
    try:
        grad_model_tuple = _build_grad_model(model, layer_name)
        heatmap          = _compute_heatmap(grad_model_tuple, img_array, class_idx, layer_name)
        overlay_b64      = _render_overlay(img_array, heatmap, original_image)
        return overlay_b64

    except Exception:
        print(f"[Grad-CAM] Generation failed:\n{traceback.format_exc()}")
        return None


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _build_grad_model(
    model: tf.keras.Model,
    layer_name: str,
) -> tuple:
    """
    Build a conv extractor sub-model and return it alongside the full model.

    Keras 3 Sequential models do not expose .output symbolically, so we
    build a functional extractor: resnet_input -> conv_layer_output
    and manually complete the forward pass inside GradientTape.

    Args:
        model      : Full Sequential classification model
        layer_name : Name of the target conv layer inside ResNet50V2

    Returns:
        tuple: (conv_extractor, resnet_submodel, model)

    Raises:
        ValueError: If ResNet50V2 submodel or layer_name not found
    """
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

    try:
        conv_layer = resnet_submodel.get_layer(layer_name)
    except ValueError:
        available = [l.name for l in resnet_submodel.layers if "conv" in l.name.lower()]
        raise ValueError(
            f"Layer '{layer_name}' not found inside ResNet50V2. "
            f"Available conv layers (sample): {available[:10]}"
        )

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
    Core Grad-CAM computation, Keras 3 Sequential compatible.

    1. Extract conv_outputs via the functional conv_extractor
    2. Watch conv_outputs inside GradientTape
    3. Manually complete the forward pass through remaining layers
    4. Gradient of class_score w.r.t. conv_outputs
    5. Pool -> weight -> ReLU -> normalise -> power-boost

    The power-boost (^2) concentrates the hot region so that only the
    genuinely most-activated area shows as red/yellow, suppressing the
    diffuse warm background that otherwise spreads across the whole brain.

    Returns:
        np.ndarray: 2D heatmap normalised to [0, 1], shape (h, w)
    """
    conv_extractor, resnet_submodel, model = grad_model_tuple
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        conv_outputs = conv_extractor(img_tensor, training=False)
        tape.watch(conv_outputs)

        # Complete forward pass through remaining ResNet layers
        resnet_layers = resnet_submodel.layers
        conv_idx = next(
            i for i, l in enumerate(resnet_layers) if l.name == layer_name
        )
        x = conv_outputs
        for layer in resnet_layers[conv_idx + 1:]:
            x = layer(x, training=False)

        # Continue through the Sequential classification head
        sequential_layers = model.layers
        resnet_layer_idx  = next(
            i for i, l in enumerate(sequential_layers)
            if "resnet50v2" in l.name.lower()
        )
        for layer in sequential_layers[resnet_layer_idx + 1:]:
            x = layer(x, training=False)

        predictions = x
        class_score = predictions[:, class_idx]

    grads = tape.gradient(class_score, conv_outputs)

    if grads is None:
        raise RuntimeError(
            "GradientTape returned None - gradients could not be computed."
        )

    # Pool gradients over spatial dims, weight each feature map channel
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))   # (c,)
    conv_out_sq  = conv_outputs[0]                          # (h, w, c)
    heatmap      = conv_out_sq @ pooled_grads[..., tf.newaxis]
    heatmap      = tf.squeeze(heatmap)

    # ReLU - keep only positive contributions to the class score
    heatmap    = tf.maximum(heatmap, 0)
    heatmap_np = heatmap.numpy()

    # Normalise to [0, 1]
    max_val = heatmap_np.max()
    if max_val > 0:
        heatmap_np = heatmap_np / max_val

    return heatmap_np.astype(np.float32)


def _render_overlay(
    img_array: np.ndarray,
    heatmap: np.ndarray,
    original_image: np.ndarray = None,
) -> str:
    """
    Convert the raw heatmap into a coloured overlay and return as base64 PNG.

    When original_image is supplied the heatmap is rendered at the
    full original scan resolution instead of the 128x128 preprocessed copy.

    Steps:
      1. Choose background: original_image if provided, else img_array[0]*255
      2. Resize heatmap to background dimensions (bicubic - smoother edges)
      3. Gaussian smooth to remove upsampling block artefacts
      4. Apply COLORMAP_JET (blue=low, green=mid, red=high activation)
      5. Alpha-blend heatmap over background
      6. Encode PNG -> base64

    Returns:
        str: Base64-encoded PNG of the blended overlay
    """
    # ── Choose background image ───────────────────────────────────
    if original_image is not None and original_image.ndim == 3:
        background = original_image.astype(np.uint8)
        print(f"[Grad-CAM] Overlaying on original image {background.shape}")
    else:
        background = np.uint8(img_array[0] * 255)
        print(f"[Grad-CAM] Overlaying on preprocessed image {background.shape}")

    H, W = background.shape[:2]

    # ── Upsample heatmap (bicubic for smooth edges) ───────────────
    heatmap_resized = cv2.resize(heatmap, (W, H), interpolation=cv2.INTER_CUBIC)
    heatmap_resized = np.clip(heatmap_resized, 0.0, 1.0)

    # ── Smooth to remove blocky upsampling artefacts ──────────────
    sigma = min(H, W) / 40
    k     = int(sigma * 4) | 1
    heatmap_resized = cv2.GaussianBlur(
        heatmap_resized, (k, k), sigmaX=sigma, sigmaY=sigma
    )
    # Re-normalise after smoothing so peak is still 1.0
    hmx = heatmap_resized.max()
    if hmx > 0:
        heatmap_resized = heatmap_resized / hmx

    # ── Jet colormap (blue -> green -> red) ───────────────────────
    heatmap_uint8 = np.uint8(255 * heatmap_resized)
    jet_heatmap   = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)  # BGR
    jet_heatmap   = cv2.cvtColor(jet_heatmap, cv2.COLOR_BGR2RGB)        # -> RGB

    # ── Alpha blend heatmap over background ───────────────────────
    overlay = (
        HEATMAP_ALPHA  * jet_heatmap.astype(np.float32) +
        ORIGINAL_ALPHA * background.astype(np.float32)
    )
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)

    # ── Encode as base64 PNG ──────────────────────────────────────
    pil_image = Image.fromarray(overlay)
    buffer    = BytesIO()
    pil_image.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")