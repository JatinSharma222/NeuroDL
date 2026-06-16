import json
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray):  return obj.tolist()
        return super().default(obj)
import os


import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    roc_curve, auc,
)
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from src.utils import load_local_model
from src.config import *

# ── Configuration ─────────────────────────────────────────────────────────────
TEST_DATA_DIR = 'data/raw_dataset/Testing'
IMG_SIZE      = 224
BATCH_SIZE    = 32

print("=" * 70)
print("NEURODL MODEL EVALUATION")
print("=" * 70)

# ── Test dataset ──────────────────────────────────────────────────────────────
print("\nLoading test data from:", TEST_DATA_DIR)

datagen        = ImageDataGenerator(rescale=1.0 / 255.0)
test_generator = datagen.flow_from_directory(
    TEST_DATA_DIR,
    target_size = (IMG_SIZE, IMG_SIZE),
    batch_size  = BATCH_SIZE,
    class_mode  = 'categorical',
    shuffle     = False,
)

class_labels = list(test_generator.class_indices.keys())
num_classes  = len(class_labels)

print(f"\n  Classes     : {test_generator.class_indices}")
print(f"  Test images : {test_generator.n}")

# ── Load models ───────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("LOADING MODELS")
print("=" * 70)

resnet_model = load_local_model("models/ResNet50V2.keras")
custom_model = load_local_model("models/new_custom_model.keras")
meta_model   = load_local_model("models/meta_model.keras")

# ── ResNet50V2 ────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("EVALUATING RESNET50V2")
print("=" * 70)

test_generator.reset()
resnet_preds        = resnet_model.predict(test_generator, verbose=1)
resnet_pred_classes = np.argmax(resnet_preds, axis=1)
resnet_accuracy     = accuracy_score(test_generator.classes, resnet_pred_classes)
print(f"\n✓ ResNet50V2 Accuracy: {resnet_accuracy * 100:.2f}%")

# ── Custom CNN ────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("EVALUATING CUSTOM CNN")
print("=" * 70)

test_generator.reset()
custom_preds        = custom_model.predict(test_generator, verbose=1)
custom_pred_classes = np.argmax(custom_preds, axis=1)
custom_accuracy     = accuracy_score(test_generator.classes, custom_pred_classes)
print(f"\n✓ Custom CNN Accuracy: {custom_accuracy * 100:.2f}%")

# ── Meta Model ────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("EVALUATING META MODEL (ENSEMBLE)")
print("=" * 70)

combined_preds    = np.column_stack((resnet_preds, custom_preds))
meta_preds        = meta_model.predict(combined_preds, verbose=1)
meta_pred_classes = np.argmax(meta_preds, axis=1)
meta_accuracy     = accuracy_score(test_generator.classes, meta_pred_classes)
print(f"\n✓ Meta Model Accuracy: {meta_accuracy * 100:.2f}%")

# ── Summary ───────────────────────────────────────────────────────────────────
improvement = (meta_accuracy - max(resnet_accuracy, custom_accuracy)) * 100
print(f"\n{'='*50}")
print(f"  ResNet50V2  : {resnet_accuracy * 100:.2f}%")
print(f"  Custom CNN  : {custom_accuracy * 100:.2f}%")
print(f"  Meta Model  : {meta_accuracy * 100:.2f}%  ({improvement:+.2f}%)")
print(f"{'='*50}")

# ── Classification report ─────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("CLASSIFICATION REPORT (META MODEL)")
print("=" * 70)
print("\n" + classification_report(
    test_generator.classes, meta_pred_classes, target_names=class_labels
))

# ── Confusion matrix ──────────────────────────────────────────────────────────
cm = confusion_matrix(test_generator.classes, meta_pred_classes)
print("Confusion Matrix:\n", cm)

# ── Per-class accuracy ────────────────────────────────────────────────────────
per_class_acc = {}
for i, cls in enumerate(class_labels):
    mask = test_generator.classes == i
    if np.sum(mask) > 0:
        acc = accuracy_score(
            test_generator.classes[mask],
            meta_pred_classes[mask],
        )
        per_class_acc[cls] = round(float(acc), 4)
        print(f"  {cls:<20} {acc * 100:.2f}%  ({np.sum(mask)} images)")

# ── ROC curves ────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("COMPUTING ROC CURVES (META MODEL)")
print("=" * 70)

roc_data = {}
for i, cls in enumerate(class_labels):
    y_true_bin = (test_generator.classes == i).astype(int)
    y_score    = meta_preds[:, i]
    fpr, tpr, thresholds = roc_curve(y_true_bin, y_score)
    roc_auc    = auc(fpr, tpr)

    # Downsample to ≤100 points for the frontend
    n    = len(fpr)
    step = max(1, n // 100)
    roc_data[cls] = {
        "fpr":        fpr[::step].tolist() + [fpr[-1]],
        "tpr":        tpr[::step].tolist() + [tpr[-1]],
        "thresholds": thresholds[::step].tolist() + [thresholds[-1]],
        "auc":        round(float(roc_auc), 4),
    }
    print(f"  {cls:<20} AUC = {roc_auc:.4f}")

# ── Save visualisations ───────────────────────────────────────────────────────
os.makedirs("training_outputs/evaluation", exist_ok=True)

# Confusion matrix heatmap
plt.figure(figsize=(10, 8))
sns.heatmap(
    cm, annot=True, fmt="d", cmap="Blues",
    xticklabels=class_labels, yticklabels=class_labels,
)
plt.title("Confusion Matrix — Meta Model")
plt.ylabel("True Label")
plt.xlabel("Predicted Label")
plt.tight_layout()
plt.savefig("training_outputs/evaluation/confusion_matrix.png", dpi=300)
plt.close()
print("\n✓ Confusion matrix plot saved")

# Accuracy comparison bar chart
plt.figure(figsize=(10, 6))
models = ['ResNet50V2', 'Custom CNN', 'Meta Model']
accs   = [resnet_accuracy * 100, custom_accuracy * 100, meta_accuracy * 100]
colors = ['#3498db', '#e74c3c', '#2ecc71']
bars   = plt.bar(models, accs, color=colors)
plt.ylabel('Accuracy (%)')
plt.title('Model Accuracy Comparison')
plt.ylim([0, 100])
plt.grid(axis='y', alpha=0.3)
for bar in bars:
    h = bar.get_height()
    plt.text(bar.get_x() + bar.get_width() / 2., h,
             f'{h:.2f}%', ha='center', va='bottom', fontweight='bold')
plt.tight_layout()
plt.savefig("training_outputs/evaluation/accuracy_comparison.png", dpi=300)
plt.close()
print("✓ Accuracy comparison plot saved")

# ── NEW: Save JSON for frontend interactive charts ─────────────────────────────
performance_json = {
    "confusion_matrix": {
        "matrix": cm.tolist(),
        "labels": class_labels,
        "total":  int(test_generator.n),
    },
    "roc_data": roc_data,
    "accuracy": {
        "resnet":     round(float(resnet_accuracy), 4),
        "custom_cnn": round(float(custom_accuracy), 4),
        "meta_model": round(float(meta_accuracy),   4),
    },
    "per_class_accuracy": per_class_acc,
    "improvement": round(float(improvement), 4),
}

json_path = "training_outputs/evaluation/model_performance.json"
with open(json_path, "w") as f:
    json.dump(performance_json, f, indent=2, cls=NumpyEncoder)

print(f"✓ Model performance JSON saved: {json_path}")

# ── Final summary ─────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("EVALUATION COMPLETE")
print("=" * 70)
print(f"\n  Best model : Meta Model  {meta_accuracy * 100:.2f}%")
print(f"  Outputs    : training_outputs/evaluation/")
print(f"  JSON       : {json_path}  ← used by frontend charts")