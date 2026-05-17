# this file was used to train the seg_model3.keras in kaggle notebook

# ─── Cell 1: Imports ──────────────────────────────────────────────────────────
import os
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.applications import VGG16
from keras.regularizers import l2
from sklearn.model_selection import train_test_split
from skimage.io import imread
from skimage.transform import resize

print("TensorFlow version:", tf.__version__)
print("GPU available:", len(tf.config.list_physical_devices('GPU')) > 0)


# ─── Cell 2: Data Loading ─────────────────────────────────────────────────────
# Updated for the kaggle_3m dataset structure:
#   kaggle_3m/
#     TCGA_CS_4941_.../
#       image1.tif          ← MRI image
#       image1_mask.tif     ← paired mask (identified by _mask suffix)
#     TCGA_CS_4942_.../
#       ...

def load_data(base_path):
    """
    Load paired MRI images and masks from the kaggle_3m folder structure.

    Each patient subfolder contains:
      - image files  : *.tif files NOT ending with _mask.tif
      - mask files   : *.tif files ending with _mask.tif

    Images and masks are paired by sorting both lists — the naming
    convention guarantees they stay in the same order.

    Args:
        base_path : Path to the kaggle_3m root directory

    Returns:
        images : np.ndarray, shape (N, 224, 224, 3), float32
        masks  : np.ndarray, shape (N, 224, 224, 1), float32
    """
    images = []
    masks  = []

    patient_dirs = sorted([
        d for d in os.listdir(base_path)
        if os.path.isdir(os.path.join(base_path, d))
    ])

    print(f"Found {len(patient_dirs)} patient directories")

    for patient_dir in patient_dirs:
        patient_path = os.path.join(base_path, patient_dir)
        all_files    = sorted(os.listdir(patient_path))

        img_files  = [f for f in all_files
                      if f.endswith('.tif') and not f.endswith('_mask.tif')]
        mask_files = [f for f in all_files
                      if f.endswith('_mask.tif')]

        # Skip if unpaired
        if len(img_files) != len(mask_files):
            print(f"  ⚠ Skipping {patient_dir}: "
                  f"{len(img_files)} images vs {len(mask_files)} masks")
            continue

        for img_file, mask_file in zip(img_files, mask_files):
            # ── Load and resize image ──────────────────────────────
            img = imread(os.path.join(patient_path, img_file))
            img = resize(img, (224, 224), mode='constant', preserve_range=True)
            if img.ndim == 2:                          # grayscale → RGB
                img = np.stack([img] * 3, axis=-1)
            elif img.shape[2] == 4:                    # RGBA → RGB
                img = img[:, :, :3]
            images.append(img)

            # ── Load and resize mask ───────────────────────────────
            mask = imread(os.path.join(patient_path, mask_file))
            mask = resize(mask, (224, 224), mode='constant', preserve_range=True)
            if mask.ndim == 2:
                mask = np.expand_dims(mask, axis=-1)   # (H, W) → (H, W, 1)
            elif mask.ndim == 3 and mask.shape[2] > 1:
                mask = mask[:, :, :1]                  # keep first channel only
            masks.append(mask)

    print(f"Loaded {len(images)} image-mask pairs")
    return np.array(images, dtype=np.float32), np.array(masks, dtype=np.float32)


def preprocess_data(images, masks):
    """Normalise to [0, 1] and binarise masks."""
    images = images / 255.0
    masks  = masks  / 255.0
    masks[masks > 0] = 1          # binary mask
    return images, masks


def split_data(images, masks, test_size=0.2, random_state=42):
    return train_test_split(images, masks,
                            test_size=test_size,
                            random_state=random_state)


# ─── Cell 3: Model Architecture ───────────────────────────────────────────────
def unet_with_backbone(input_shape=(224, 224, 3)):
    """
    VGG16-backed U-Net with skip connections and Dropout regularisation.

    Encoder : VGG16 pretrained on ImageNet (frozen)
    Decoder : 5 transposed-conv upsampling blocks with skip connections
    Output  : (224, 224, 1) sigmoid — binary tumour mask
    """
    base_model = VGG16(weights='imagenet',
                       include_top=False,
                       input_shape=input_shape)

    # ── Bottleneck ────────────────────────────────────────────────
    x = layers.Conv2D(1024, (3, 3), activation='relu',
                      padding='same')(base_model.output)
    x = layers.Dropout(0.5)(x)
    x = layers.Conv2D(1024, (3, 3), activation='relu', padding='same')(x)

    # ── Decoder block 1 ──────────────────────────────────────────
    x = layers.Conv2DTranspose(512, (2, 2), strides=(2, 2), padding='same')(x)
    x = layers.concatenate([x, base_model.get_layer('block5_conv3').output])
    x = layers.Conv2D(512, (3, 3), activation='relu',
                      padding='same', kernel_regularizer=l2(0.001))(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Conv2D(512, (3, 3), activation='relu',
                      padding='same', kernel_regularizer=l2(0.001))(x)

    # ── Decoder block 2 ──────────────────────────────────────────
    x = layers.Conv2DTranspose(256, (2, 2), strides=(2, 2), padding='same')(x)
    x = layers.concatenate([x, base_model.get_layer('block4_conv3').output])
    x = layers.Conv2D(256, (3, 3), activation='relu',
                      padding='same', kernel_regularizer=l2(0.001))(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Conv2D(256, (3, 3), activation='selu', padding='same')(x)

    # ── Decoder block 3 ──────────────────────────────────────────
    x = layers.Conv2DTranspose(128, (2, 2), strides=(2, 2), padding='same')(x)
    x = layers.concatenate([x, base_model.get_layer('block3_conv3').output])
    x = layers.Conv2D(128, (3, 3), activation='relu',
                      padding='same', kernel_regularizer=l2(0.001))(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Conv2D(128, (3, 3), activation='relu', padding='same')(x)

    # ── Decoder block 4 ──────────────────────────────────────────
    x = layers.Conv2DTranspose(64, (2, 2), strides=(2, 2), padding='same')(x)
    x = layers.concatenate([x, base_model.get_layer('block2_conv2').output])
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Conv2D(64, (3, 3), activation='relu',
                      padding='same', kernel_regularizer=l2(0.001))(x)

    # ── Decoder block 5 ──────────────────────────────────────────
    x = layers.Conv2DTranspose(32, (2, 2), strides=(2, 2), padding='same')(x)
    x = layers.Conv2D(32, (3, 3), activation='relu',
                      padding='same', kernel_regularizer=l2(0.001))(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Conv2D(32, (3, 3), activation='selu',
                      padding='same', kernel_regularizer=l2(0.001))(x)

    # ── Output ───────────────────────────────────────────────────
    outputs = layers.Conv2D(1, (1, 1), activation='sigmoid')(x)

    model = models.Model(inputs=base_model.input, outputs=outputs)

    # Freeze VGG16 encoder
    for layer in base_model.layers:
        layer.trainable = False

    return model


# ─── Cell 4: Training ─────────────────────────────────────────────────────────
def train_model(model, X_train, y_train, X_val, y_val, batch_size=8):
    """
    Compile and train the U-Net.

    Fixes vs original:
      - steps_per_epoch now uses len(X_train) correctly
        (original referenced global `images` which is out of scope)
      - model.fit uses the augmented generator consistently
        (original created a generator but then called fit on raw arrays)
    """

    # ── Dice loss ────────────────────────────────────────────────
    def dice_loss(y_true, y_pred, smooth=1e-6):
        y_true_f = tf.keras.backend.flatten(y_true)
        y_pred_f = tf.keras.backend.flatten(y_pred)
        intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
        dice = (2. * intersection + smooth) / (
            tf.keras.backend.sum(y_true_f) +
            tf.keras.backend.sum(y_pred_f) + smooth
        )
        return 1 - dice

    model.compile(
        optimizer = Adam(learning_rate=5e-5),
        loss      = dice_loss,
        metrics   = [tf.keras.metrics.MeanIoU(num_classes=2)],
    )

    # ── Callbacks ────────────────────────────────────────────────
    callbacks = [
        EarlyStopping(
            monitor             = 'val_loss',
            patience            = 10,
            restore_best_weights = True,
            verbose             = 1,
        ),
        ModelCheckpoint(
            'seg_model3.keras',
            monitor        = 'val_mean_io_u',
            save_best_only = True,
            mode           = 'max',
            verbose        = 1,
        ),
    ]

    # ── Augmented data generators ─────────────────────────────────
    aug_args = dict(
        rotation_range    = 20,
        width_shift_range  = 0.1,
        height_shift_range = 0.1,
        shear_range       = 0.1,
        zoom_range        = 0.1,
        horizontal_flip   = True,
        fill_mode         = 'nearest',
    )
    image_datagen = ImageDataGenerator(**aug_args)
    mask_datagen  = ImageDataGenerator(**aug_args)

    image_datagen.fit(X_train, seed=42)
    mask_datagen.fit(y_train,  seed=42)

    image_gen = image_datagen.flow(X_train, batch_size=batch_size, seed=42)
    mask_gen  = mask_datagen.flow(y_train,  batch_size=batch_size, seed=42)

    def combined_generator(img_gen, msk_gen):
        while True:
            yield next(img_gen), next(msk_gen)

    train_gen          = combined_generator(image_gen, mask_gen)
    steps_per_epoch    = max(1, len(X_train) // batch_size)   # FIX: was len(images)

    print(f"\nTraining on {len(X_train)} samples, "
          f"validating on {len(X_val)} samples")
    print(f"Steps per epoch: {steps_per_epoch}, Batch size: {batch_size}")

    history = model.fit(
        train_gen,
        steps_per_epoch  = steps_per_epoch,
        validation_data  = (X_val, y_val),
        epochs           = 100,
        callbacks        = callbacks,
    )

    return history


# ─── Cell 5: Run ──────────────────────────────────────────────────────────────

# Dataset path for the kaggle_3m (Brain MRI segmentation) dataset
BASE_PATH = '/kaggle/input/datasets/mateuszbuda/lgg-mri-segmentation/kaggle_3m'

print("=" * 60)
print("LOADING DATA")
print("=" * 60)
images, masks = load_data(BASE_PATH)
images, masks = preprocess_data(images, masks)

print(f"\nImages shape : {images.shape}")
print(f"Masks shape  : {masks.shape}")
print(f"Mask unique values: {np.unique(masks)}")

X_train, X_val, y_train, y_val = split_data(images, masks)
print(f"\nTrain: {X_train.shape[0]}  |  Val: {X_val.shape[0]}")

print("\n" + "=" * 60)
print("BUILDING MODEL")
print("=" * 60)
model = unet_with_backbone()
model.summary()

print("\n" + "=" * 60)
print("TRAINING")
print("=" * 60)
history = train_model(model, X_train, y_train, X_val, y_val, batch_size=8)

print("\n✓ Training complete — model saved as seg_model3.keras")


# ─── Cell 6: Plot training history ────────────────────────────────────────────
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.plot(history.history['loss'],     label='Train Loss')
ax1.plot(history.history['val_loss'], label='Val Loss')
ax1.set_title('Dice Loss')
ax1.set_xlabel('Epoch')
ax1.legend()
ax1.grid(True)

ax2.plot(history.history['mean_io_u'],     label='Train MeanIoU')
ax2.plot(history.history['val_mean_io_u'], label='Val MeanIoU')
ax2.set_title('Mean IoU')
ax2.set_xlabel('Epoch')
ax2.legend()
ax2.grid(True)

plt.tight_layout()
plt.savefig('training_history.png', dpi=150)
plt.show()
print("Training plot saved.")


# ─── Cell 7: Sanity check — visualise 5 predictions ──────────────────────────
sample_preds = model.predict(X_val[:5])

fig, axes = plt.subplots(5, 3, figsize=(12, 20))
for i in range(5):
    axes[i, 0].imshow(X_val[i])
    axes[i, 0].set_title('Original MRI')
    axes[i, 0].axis('off')

    axes[i, 1].imshow(np.squeeze(y_val[i]), cmap='gray')
    axes[i, 1].set_title('Ground Truth Mask')
    axes[i, 1].axis('off')

    axes[i, 2].imshow(np.squeeze(sample_preds[i]) > 0.5, cmap='gray')
    axes[i, 2].set_title('Predicted Mask')
    axes[i, 2].axis('off')

plt.tight_layout()
plt.savefig('predictions_sample.png', dpi=150)
plt.show()
print("Sample predictions saved.")
print("\nDone — download seg_model3.keras from the Output tab.")