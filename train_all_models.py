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

# Configuration
IMG_SIZE = 128
BATCH_SIZE = 8
EPOCHS = 8
DATA_DIR = 'data/raw_dataset/Training'  # Adjust based on your dataset structure
VAL_SPLIT = 0.2

# Create output directories
os.makedirs('models', exist_ok=True)
os.makedirs('models/checkpoints', exist_ok=True)
os.makedirs('models/logs', exist_ok=True)
os.makedirs('training_outputs/plots', exist_ok=True)

print("="*70)
print("NEUROCURE MODEL TRAINING PIPELINE")
print("="*70)
print(f"\nConfiguration:")
print(f"  - Image Size: {IMG_SIZE}x{IMG_SIZE}")
print(f"  - Batch Size: {BATCH_SIZE}")
print(f"  - Epochs: {EPOCHS}")
print(f"  - Data Directory: {DATA_DIR}")
print(f"  - GPU Available: {len(tf.config.list_physical_devices('GPU')) > 0}")
print("="*70 + "\n")

# Data augmentation and preprocessing
train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode='nearest',
    validation_split=VAL_SPLIT
)

test_datagen = ImageDataGenerator(rescale=1./255)

# Load data
print("Loading training data...")
train_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training',
    shuffle=True
)

print("Loading validation data...")
validation_generator = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation',
    shuffle=False
)

num_classes = len(train_generator.class_indices)
print(f"\nDataset Information:")
print(f"  - Number of classes: {num_classes}")
print(f"  - Class indices: {train_generator.class_indices}")
print(f"  - Training samples: {train_generator.samples}")
print(f"  - Validation samples: {validation_generator.samples}")
print("="*70 + "\n")

# Helper function to plot training history
def plot_history(history, model_name):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
    
    # Accuracy plot
    ax1.plot(history.history['accuracy'], label='Train Accuracy')
    ax1.plot(history.history['val_accuracy'], label='Val Accuracy')
    ax1.set_title(f'{model_name} - Accuracy')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Accuracy')
    ax1.legend()
    ax1.grid(True)
    
    # Loss plot
    ax2.plot(history.history['loss'], label='Train Loss')
    ax2.plot(history.history['val_loss'], label='Val Loss')
    ax2.set_title(f'{model_name} - Loss')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Loss')
    ax2.legend()
    ax2.grid(True)
    
    plt.tight_layout()
    plt.savefig(f'training_outputs/plots/{model_name}_training_history.png')
    print(f"  - Training plot saved: training_outputs/plots/{model_name}_training_history.png")

# Callbacks
def get_callbacks(model_name):
    return [
        ModelCheckpoint(
            f'models/checkpoints/{model_name}_best.keras',
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-7,
            verbose=1
        )
    ]

# ============================================================================
# MODEL 1: ResNet50V2
# ============================================================================
print("\n" + "="*70)
print("TRAINING MODEL 1: ResNet50V2")
print("="*70 + "\n")

base_model = ResNet50V2(
    include_top=False,
    weights='imagenet',
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)
base_model.trainable = False

model_resnet = keras.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.BatchNormalization(),
    layers.Dense(256, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(num_classes, activation='softmax')
], name='ResNet50V2')

model_resnet.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print(model_resnet.summary())
print("\nTraining ResNet50V2...\n")

history_resnet = model_resnet.fit(
    train_generator,
    epochs=EPOCHS,
    validation_data=validation_generator,
    callbacks=get_callbacks('ResNet50V2')
)

model_resnet.save('models/ResNet50V2.keras')
plot_history(history_resnet, 'ResNet50V2')

print("\n✓ ResNet50V2 training complete!")
print(f"  - Model saved: models/ResNet50V2.keras")
print(f"  - Best checkpoint: models/checkpoints/ResNet50V2_best.keras")

# ============================================================================
# MODEL 2: Custom CNN
# ============================================================================
print("\n" + "="*70)
print("TRAINING MODEL 2: Custom CNN")
print("="*70 + "\n")

model_custom = keras.Sequential([
    layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3)),
    
    # Block 1
    layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
    layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
    layers.MaxPooling2D((2, 2)),
    layers.BatchNormalization(),
    layers.Dropout(0.25),
    
    # Block 2
    layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
    layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
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
    
    # Classifier
    layers.Flatten(),
    layers.Dense(512, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.5),
    layers.Dense(num_classes, activation='softmax')
], name='CustomCNN')

model_custom.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print(model_custom.summary())
print("\nTraining Custom CNN...\n")

history_custom = model_custom.fit(
    train_generator,
    epochs=EPOCHS,
    validation_data=validation_generator,
    callbacks=get_callbacks('CustomCNN')
)

model_custom.save('models/new_custom_model.keras')
plot_history(history_custom, 'CustomCNN')

print("\n✓ Custom CNN training complete!")
print(f"  - Model saved: models/new_custom_model.keras")
print(f"  - Best checkpoint: models/checkpoints/CustomCNN_best.keras")

# ============================================================================
# MODEL 3: Meta Model (Ensemble)
# ============================================================================
print("\n" + "="*70)
print("TRAINING MODEL 3: Meta Model (Ensemble)")
print("="*70 + "\n")

print("Generating predictions from base models...")

# Load best checkpoints for predictions
model_resnet_best = keras.models.load_model('models/checkpoints/ResNet50V2_best.keras')
model_custom_best = keras.models.load_model('models/checkpoints/CustomCNN_best.keras')

# Get predictions
resnet_preds = model_resnet_best.predict(validation_generator, verbose=1)
custom_preds = model_custom_best.predict(validation_generator, verbose=1)

# Combine predictions
combined_preds = np.concatenate([resnet_preds, custom_preds], axis=1)

# Get true labels
y_true = validation_generator.classes
y_true_categorical = keras.utils.to_categorical(y_true, num_classes)

print(f"\nMeta-model input shape: {combined_preds.shape}")
print(f"Meta-model output shape: {y_true_categorical.shape}")

# Meta-model architecture
model_meta = keras.Sequential([
    layers.Input(shape=(num_classes * 2,)),
    layers.Dense(128, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.4),
    layers.Dense(64, activation='relu'),
    layers.BatchNormalization(),
    layers.Dropout(0.3),
    layers.Dense(num_classes, activation='softmax')
], name='MetaModel')

model_meta.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print(model_meta.summary())
print("\nTraining Meta Model...\n")

history_meta = model_meta.fit(
    combined_preds,
    y_true_categorical,
    epochs=30,
    batch_size=32,
    validation_split=0.2,
    callbacks=[
        EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3)
    ],
    verbose=1
)

model_meta.save('models/meta_model.keras')
plot_history(history_meta, 'MetaModel')

print("\n✓ Meta Model training complete!")
print(f"  - Model saved: models/meta_model.keras")

# ============================================================================
# MODEL 4: Simple Segmentation Model (Placeholder)
# ============================================================================
print("\n" + "="*70)
print("CREATING MODEL 4: Segmentation Model (Placeholder)")
print("="*70 + "\n")

print("Note: Full segmentation requires pixel-level masks.")
print("Creating a simple segmentation model for compatibility...\n")

model_seg = keras.Sequential([
    layers.Input(shape=(256, 256, 3)),
    layers.Conv2D(64, 3, activation='relu', padding='same'),
    layers.Conv2D(64, 3, activation='relu', padding='same'),
    layers.MaxPooling2D(2),
    layers.Conv2D(128, 3, activation='relu', padding='same'),
    layers.Conv2D(128, 3, activation='relu', padding='same'),
    layers.UpSampling2D(2),
    layers.Conv2D(64, 3, activation='relu', padding='same'),
    layers.Conv2D(1, 1, activation='sigmoid', padding='same')
], name='SegmentationModel')

model_seg.compile(optimizer='adam', loss='binary_crossentropy')
model_seg.save('models/seg_model2.keras')

print("✓ Segmentation model created!")
print(f"  - Model saved: models/seg_model2.keras")

# ============================================================================
# TRAINING SUMMARY
# ============================================================================
print("\n" + "="*70)
print("TRAINING COMPLETE - SUMMARY")
print("="*70)
print("\nAll models have been trained and saved:")
print(f"  ✓ models/ResNet50V2.keras")
print(f"  ✓ models/new_custom_model.keras")
print(f"  ✓ models/meta_model.keras")
print(f"  ✓ models/seg_model2.keras")
print(f"\nCheckpoints saved in: models/checkpoints/")
print(f"Training plots saved in: training_outputs/plots/")
print("\nYou can now run the Flask application:")
print("  python app.py")
print("="*70 + "\n")
