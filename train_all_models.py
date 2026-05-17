import os
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import ResNet50V2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

IMG_SIZE   = 224    # 224 → conv5_block3_out gives 7×7 spatial map (vs 4×4 at 128)
                    # Grad-CAM localisation is 3× more precise at this resolution.
                    # Also matches ResNet50V2's native ImageNet input size.
BATCH_SIZE = 8
EPOCHS     = 15     # Increased from 8. EarlyStopping (patience=10) stops early anyway.
DATA_DIR   = 'data/raw_dataset/Training'
VAL_SPLIT  = 0.2

# ─── Output directories ───────────────────────────────────────────────────────

os.makedirs('models',                 exist_ok=True)
os.makedirs('models/checkpoints',     exist_ok=True)
os.makedirs('models/logs',            exist_ok=True)
os.makedirs('training_outputs/plots', exist_ok=True)

print("=" * 70)
print("NEURODL MODEL TRAINING PIPELINE")
print("=" * 70)
print(f"\nConfiguration:")
print(f"  - Image Size  : {IMG_SIZE}x{IMG_SIZE}")
print(f"  - Batch Size  : {BATCH_SIZE}")
print(f"  - Epochs      : {EPOCHS} (EarlyStopping will stop early if needed)")
print(f"  - Data Dir    : {DATA_DIR}")
print(f"  - GPU         : {len(tf.config.list_physical_devices('GPU')) > 0}")
print("=" * 70 + "\n")

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

print("Loading training data...")
train_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size = (IMG_SIZE, IMG_SIZE),
    batch_size  = BATCH_SIZE,
    class_mode  = 'categorical',
    subset      = 'training',
    shuffle     = True,
)

print("Loading validation data...")
validation_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size = (IMG_SIZE, IMG_SIZE),
    batch_size  = BATCH_SIZE,
    class_mode  = 'categorical',
    subset      = 'validation',
    shuffle     = False,  # Must be False so labels align with predictions
)

num_classes = len(train_generator.class_indices)
print(f"\nDataset Information:")
print(f"  - Classes          : {train_generator.class_indices}")
print(f"  - Training samples : {train_generator.samples}")
print(f"  - Val samples      : {validation_generator.samples}")
print("=" * 70 + "\n")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def plot_history(history, model_name):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

    ax1.plot(history.history['accuracy'],     label='Train')
    ax1.plot(history.history['val_accuracy'], label='Val')
    ax1.set_title(f'{model_name} — Accuracy')
    ax1.set_xlabel('Epoch'); ax1.set_ylabel('Accuracy')
    ax1.legend(); ax1.grid(True)

    ax2.plot(history.history['loss'],     label='Train')
    ax2.plot(history.history['val_loss'], label='Val')
    ax2.set_title(f'{model_name} — Loss')
    ax2.set_xlabel('Epoch'); ax2.set_ylabel('Loss')
    ax2.legend(); ax2.grid(True)

    plt.tight_layout()
    path = f'training_outputs/plots/{model_name}_training_history.png'
    plt.savefig(path)
    print(f"  - Plot saved: {path}")
    plt.close()


def get_callbacks(model_name):
    return [
        ModelCheckpoint(
            f'models/checkpoints/{model_name}_best.keras',
            monitor        = 'val_accuracy',
            save_best_only = True,
            verbose        = 1,
        ),
        EarlyStopping(
            monitor              = 'val_loss',
            patience             = 10,
            restore_best_weights = True,
            verbose              = 1,
        ),
        ReduceLROnPlateau(
            monitor  = 'val_loss',
            factor   = 0.5,
            patience = 5,
            min_lr   = 1e-7,
            verbose  = 1,
        ),
    ]


# ─── MODEL 1: ResNet50V2 ──────────────────────────────────────────────────────

print("\n" + "=" * 70)
print("TRAINING MODEL 1: ResNet50V2")
print("=" * 70 + "\n")

base_model = ResNet50V2(
    include_top = False,
    weights     = 'imagenet',
    input_shape = (IMG_SIZE, IMG_SIZE, 3),
)
base_model.trainable = False

model_resnet = keras.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.BatchNormalization(),
    layers.Dense(256, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(num_classes, activation='softmax'),
], name='ResNet50V2')

model_resnet.compile(
    optimizer = keras.optimizers.Adam(learning_rate=0.001),
    loss      = 'categorical_crossentropy',
    metrics   = ['accuracy'],
)
print(model_resnet.summary())
print("\nTraining ResNet50V2...\n")

history_resnet = model_resnet.fit(
    train_generator,
    epochs          = EPOCHS,
    validation_data = validation_generator,
    callbacks       = get_callbacks('ResNet50V2'),
)

model_resnet.save('models/ResNet50V2.keras')
plot_history(history_resnet, 'ResNet50V2')

best_resnet_acc = max(history_resnet.history['val_accuracy'])
print(f"\n✓ ResNet50V2 complete  |  best val_accuracy: {best_resnet_acc:.4f}")
print(f"  - Saved     : models/ResNet50V2.keras")
print(f"  - Checkpoint: models/checkpoints/ResNet50V2_best.keras")


# ─── MODEL 2: Custom CNN ──────────────────────────────────────────────────────
#
# FIX: Flatten() → GlobalAveragePooling2D()
#
# At 224×224, after 4 MaxPool layers the spatial map is 14×14×256 = 50,176.
# Flatten() → Dense(512) created 25,690,624 params in ONE layer → catastrophic
# overfitting → val_accuracy ~63%.
#
# GlobalAveragePooling2D() averages each of the 256 feature maps to 1 value
# → (256,) vector → Dense(512) only needs 131,072 params → model generalises.

print("\n" + "=" * 70)
print("TRAINING MODEL 2: Custom CNN")
print("=" * 70 + "\n")

model_custom = keras.Sequential([
    layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3)),

    # Block 1
    layers.Conv2D(32,  (3, 3), activation='relu', padding='same'),
    layers.Conv2D(32,  (3, 3), activation='relu', padding='same'),
    layers.MaxPooling2D((2, 2)),
    layers.BatchNormalization(),
    layers.Dropout(0.25),

    # Block 2
    layers.Conv2D(64,  (3, 3), activation='relu', padding='same'),
    layers.Conv2D(64,  (3, 3), activation='relu', padding='same'),
    layers.MaxPooling2D((2, 2)),
    layers.BatchNormalization(),
    layers.Dropout(0.25),

    # Block 3
    layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
    layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
    layers.MaxPooling2D((2, 2)),
    layers.BatchNormalization(),
    layers.Dropout(0.25),

    # Block 4
    layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
    layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
    layers.MaxPooling2D((2, 2)),
    layers.BatchNormalization(),
    layers.Dropout(0.25),

    # GlobalAveragePooling replaces Flatten — fixes the 25M param explosion
    layers.GlobalAveragePooling2D(),
    layers.Dense(512, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.5),
    layers.Dense(num_classes, activation='softmax'),
], name='CustomCNN')

model_custom.compile(
    optimizer = keras.optimizers.Adam(learning_rate=0.001),
    loss      = 'categorical_crossentropy',
    metrics   = ['accuracy'],
)
print(model_custom.summary())
print("\nTraining Custom CNN...\n")

history_custom = model_custom.fit(
    train_generator,
    epochs          = EPOCHS,
    validation_data = validation_generator,
    callbacks       = get_callbacks('CustomCNN'),
)

model_custom.save('models/new_custom_model.keras')
plot_history(history_custom, 'CustomCNN')

best_custom_acc = max(history_custom.history['val_accuracy'])
print(f"\n✓ Custom CNN complete  |  best val_accuracy: {best_custom_acc:.4f}")
print(f"  - Saved     : models/new_custom_model.keras")
print(f"  - Checkpoint: models/checkpoints/CustomCNN_best.keras")


# ─── MODEL 3: Meta Model (Ensemble) ──────────────────────────────────────────
#
# FIX: shuffle combined_preds + labels before training.
#
# Bug: validation_generator is ordered by class (shuffle=False).
# model.fit(..., validation_split=0.2) takes the LAST 20% as validation —
# which ended up being almost entirely pituitary samples → val_accuracy: 0.0000.
#
# Fix: shuffle combined_preds and y_true_categorical with the same permutation
# before fit() so the validation split is balanced across all 4 classes.

print("\n" + "=" * 70)
print("TRAINING MODEL 3: Meta Model (Ensemble)")
print("=" * 70 + "\n")

print("Loading best checkpoints...")
model_resnet_best = keras.models.load_model('models/checkpoints/ResNet50V2_best.keras')
model_custom_best = keras.models.load_model('models/checkpoints/CustomCNN_best.keras')

print("Generating predictions on validation set...")
validation_generator.reset()
resnet_preds = model_resnet_best.predict(validation_generator, verbose=1)

validation_generator.reset()
custom_preds = model_custom_best.predict(validation_generator, verbose=1)

combined_preds     = np.concatenate([resnet_preds, custom_preds], axis=1)
y_true             = validation_generator.classes
y_true_categorical = keras.utils.to_categorical(y_true, num_classes)

print(f"\nMeta-model input  shape : {combined_preds.shape}")
print(f"Meta-model target shape : {y_true_categorical.shape}")

# ── Shuffle — critical fix for val_accuracy=0 bug ─────────────────
np.random.seed(42)
indices            = np.random.permutation(len(combined_preds))
combined_preds     = combined_preds[indices]
y_true_categorical = y_true_categorical[indices]
print("✓ Data shuffled — validation split will now be class-balanced")

model_meta = keras.Sequential([
    layers.Input(shape=(num_classes * 2,)),
    layers.Dense(128, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.4),
    layers.Dense(64, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.3),
    layers.Dense(num_classes, activation='softmax'),
], name='MetaModel')

model_meta.compile(
    optimizer = keras.optimizers.Adam(learning_rate=0.001),
    loss      = 'categorical_crossentropy',
    metrics   = ['accuracy'],
)
print(model_meta.summary())
print("\nTraining Meta Model...\n")

history_meta = model_meta.fit(
    combined_preds,
    y_true_categorical,
    epochs           = 50,
    batch_size       = 32,
    validation_split = 0.2,
    callbacks        = [
        ModelCheckpoint(
            'models/checkpoints/MetaModel_best.keras',
            monitor        = 'val_accuracy',
            save_best_only = True,
            verbose        = 1,
        ),
        EarlyStopping(
            monitor              = 'val_loss',
            patience             = 8,
            restore_best_weights = True,
            verbose              = 1,
        ),
        ReduceLROnPlateau(
            monitor  = 'val_loss',
            factor   = 0.5,
            patience = 4,
            verbose  = 1,
        ),
    ],
    verbose = 1,
)

model_meta.save('models/meta_model.keras')
plot_history(history_meta, 'MetaModel')

best_meta_acc = max(history_meta.history['val_accuracy'])
print(f"\n✓ Meta Model complete  |  best val_accuracy: {best_meta_acc:.4f}")
print(f"  - Saved: models/meta_model.keras")


# ─── TRAINING SUMMARY ─────────────────────────────────────────────────────────

print("\n" + "=" * 70)
print("TRAINING COMPLETE — SUMMARY")
print("=" * 70)
print(f"\n  ResNet50V2  best val_accuracy : {best_resnet_acc*100:.2f}%")
print(f"  Custom CNN  best val_accuracy : {best_custom_acc*100:.2f}%")
print(f"  Meta Model  best val_accuracy : {best_meta_acc*100:.2f}%")
print(f"\nModels saved:")
print(f"  ✓ models/ResNet50V2.keras")
print(f"  ✓ models/new_custom_model.keras")
print(f"  ✓ models/meta_model.keras")
print(f"\nCheckpoints : models/checkpoints/")
print(f"Plots       : training_outputs/plots/")
print(f"\nNext step — fine-tune the ResNet50V2 backbone:")
print(f"  python finetune_resnet.py")
print("=" * 70 + "\n")