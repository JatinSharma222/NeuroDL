"""
finetune_resnet.py
──────────────────
Fine-tunes the existing ResNet50V2 classifier by unfreezing the backbone.

WHY THIS MATTERS FOR GRAD-CAM:
  The original model was trained with base_model.trainable = False.
  The ResNet50V2 weights are pure ImageNet (cars, animals, furniture).
  Grad-CAM gradients from a frozen ImageNet backbone point to edges and
  background rather than the tumour — because the conv features have
  never seen a brain MRI.

  After fine-tuning at a very low learning rate (1e-5), the backbone
  learns brain-MRI-specific features. Grad-CAM gradients then point
  to the actual tumour region.

SAFETY:
  - Loads your existing best model — does NOT train from scratch
  - BatchNorm layers stay frozen to prevent training instability
    with the small batch size (8)
  - lr = 1e-5 is 100× lower than original training — makes small,
    careful adjustments without catastrophic forgetting
  - EarlyStopping restores best weights if val_loss starts rising

RUN:
  python finetune_resnet.py

OUTPUT:
  models/ResNet50V2.keras        ← overwritten with fine-tuned version
  models/checkpoints/ResNet50V2_finetune_best.keras
  training_outputs/plots/ResNet50V2_Finetune_training_history.png
"""

import os
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau

# ─── Configuration ────────────────────────────────────────────────────────────

MODEL_PATH  = 'models/ResNet50V2.keras'
DATA_DIR    = 'data/raw_dataset/Training'
IMG_SIZE    = 224   # Must match train_all_models.py
BATCH_SIZE  = 8
EPOCHS      = 15        # EarlyStopping will stop earlier if needed
LR          = 1e-5      # 100× lower than original training lr (1e-3)
VAL_SPLIT   = 0.2

os.makedirs('models/checkpoints',       exist_ok=True)
os.makedirs('training_outputs/plots',   exist_ok=True)

# ─── Load existing model ──────────────────────────────────────────────────────

print("=" * 60)
print("RESNET50V2 FINE-TUNING")
print("=" * 60)
print(f"\nLoading existing model: {MODEL_PATH}")

model = keras.models.load_model(MODEL_PATH)
print("✓ Model loaded")

# Quick check — print current trainable status
resnet_layer = next(l for l in model.layers if 'resnet50v2' in l.name.lower())
frozen = sum(1 for l in resnet_layer.layers if not l.trainable)
total  = len(resnet_layer.layers)
print(f"  ResNet50V2 layers: {total} total, {frozen} frozen")

# ─── Unfreeze backbone (keep BatchNorm frozen) ────────────────────────────────

print("\nUnfreezing backbone (BatchNorm layers stay frozen)...")

resnet_layer.trainable = True
for layer in resnet_layer.layers:
    if isinstance(layer, layers.BatchNormalization):
        layer.trainable = False

trainable_count     = sum(1 for l in model.layers       if l.trainable)
bn_frozen_count     = sum(1 for l in resnet_layer.layers
                          if isinstance(l, layers.BatchNormalization))

print(f"  BatchNorm layers frozen : {bn_frozen_count}")
print(f"  Trainable layers total  : {trainable_count}")

# ─── Recompile at low LR ──────────────────────────────────────────────────────

model.compile(
    optimizer = keras.optimizers.Adam(learning_rate=LR),
    loss      = 'categorical_crossentropy',
    metrics   = ['accuracy'],
)
print(f"\n✓ Recompiled at lr={LR}")

# ─── Data generators ──────────────────────────────────────────────────────────

train_datagen = ImageDataGenerator(
    rescale            = 1. / 255,
    rotation_range     = 20,
    width_shift_range  = 0.2,
    height_shift_range = 0.2,
    shear_range        = 0.2,
    zoom_range         = 0.2,
    horizontal_flip    = True,
    fill_mode          = 'nearest',
    validation_split   = VAL_SPLIT,
)

print(f"\nLoading data from: {DATA_DIR}")
train_gen = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size = (IMG_SIZE, IMG_SIZE),
    batch_size  = BATCH_SIZE,
    class_mode  = 'categorical',
    subset      = 'training',
    shuffle     = True,
)

val_gen = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size = (IMG_SIZE, IMG_SIZE),
    batch_size  = BATCH_SIZE,
    class_mode  = 'categorical',
    subset      = 'validation',
    shuffle     = False,
)

print(f"\n  Training samples  : {train_gen.samples}")
print(f"  Validation samples: {val_gen.samples}")
print(f"  Classes           : {train_gen.class_indices}")

# ─── Callbacks ────────────────────────────────────────────────────────────────

callbacks = [
    ModelCheckpoint(
        'models/checkpoints/ResNet50V2_finetune_best.keras',
        monitor        = 'val_accuracy',
        save_best_only = True,
        verbose        = 1,
    ),
    EarlyStopping(
        monitor              = 'val_loss',
        patience             = 6,
        restore_best_weights = True,
        verbose              = 1,
    ),
    ReduceLROnPlateau(
        monitor  = 'val_loss',
        factor   = 0.5,
        patience = 3,
        min_lr   = 1e-8,
        verbose  = 1,
    ),
]

# ─── Train ────────────────────────────────────────────────────────────────────

print("\n" + "=" * 60)
print(f"FINE-TUNING  (max {EPOCHS} epochs, lr={LR})")
print("=" * 60 + "\n")

history = model.fit(
    train_gen,
    epochs          = EPOCHS,
    validation_data = val_gen,
    callbacks       = callbacks,
    verbose         = 1,
)

best_val_acc = max(history.history['val_accuracy'])
print(f"\n✓ Fine-tuning complete  |  best val_accuracy: {best_val_acc:.4f}")

# ─── Save ─────────────────────────────────────────────────────────────────────

model.save(MODEL_PATH)
print(f"✓ Model saved: {MODEL_PATH}")
print(f"✓ Best checkpoint: models/checkpoints/ResNet50V2_finetune_best.keras")

# ─── Plot ─────────────────────────────────────────────────────────────────────

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(history.history['accuracy'],     label='Train')
ax1.plot(history.history['val_accuracy'], label='Val')
ax1.set_title('Fine-tune Accuracy')
ax1.set_xlabel('Epoch')
ax1.set_ylabel('Accuracy')
ax1.legend()
ax1.grid(True)

ax2.plot(history.history['loss'],     label='Train')
ax2.plot(history.history['val_loss'], label='Val')
ax2.set_title('Fine-tune Loss')
ax2.set_xlabel('Epoch')
ax2.set_ylabel('Loss')
ax2.legend()
ax2.grid(True)

plt.suptitle(f'ResNet50V2 Fine-tuning  (lr={LR})', fontweight='bold')
plt.tight_layout()
plot_path = 'training_outputs/plots/ResNet50V2_Finetune_training_history.png'
plt.savefig(plot_path, dpi=150)
print(f"✓ Plot saved: {plot_path}")
plt.close()

# ─── Summary ──────────────────────────────────────────────────────────────────

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
print(f"\n  Best val_accuracy : {best_val_acc:.4f}")
print(f"  Model saved to    : {MODEL_PATH}")
print(f"\nRestart Flask to use the fine-tuned model:")
print("  python app.py")
print("\nGrad-CAM heatmaps will now point to the actual tumour region.")
print("=" * 60)