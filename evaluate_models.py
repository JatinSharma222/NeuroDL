import numpy as np
import os
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from src.utils import load_local_model
from src.config import *

# Configuration
TEST_DATA_DIR = 'data/raw_dataset/Testing'  
IMG_SIZE = 128  
BATCH_SIZE = 32

print("="*70)
print("NEURODL MODEL EVALUATION")
print("="*70)

# Load test dataset
print("\nLoading test data from:", TEST_DATA_DIR)

datagen = ImageDataGenerator(rescale=1.0/255.0)
test_generator = datagen.flow_from_directory(
    TEST_DATA_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    shuffle=False
)

class_labels = list(test_generator.class_indices.keys())
num_classes = len(class_labels)

print("\nTest Dataset Info:")
print(f"  - Classes: {test_generator.class_indices}")
print(f"  - Total test images: {test_generator.n}")
print(f"  - Number of classes: {num_classes}")

print("\n" + "="*70)
print("LOADING MODELS")
print("="*70)

# Load models
print("\n[1/3] Loading ResNet50V2 model...")
resnet_model = load_local_model("models/ResNet50V2.keras")
print("✓ ResNet50V2 loaded")

print("\n[2/3] Loading Custom CNN model...")
custom_model = load_local_model("models/new_custom_model.keras")
print("✓ Custom CNN loaded")

print("\n[3/3] Loading Meta model...")
meta_model = load_local_model("models/meta_model.keras")
print("✓ Meta model loaded")

# Evaluate ResNet50V2
print("\n" + "="*70)
print("EVALUATING RESNET50V2 MODEL")
print("="*70)

test_generator.reset()
resnet_preds = resnet_model.predict(test_generator, verbose=1)
resnet_pred_classes = np.argmax(resnet_preds, axis=1)
resnet_accuracy = accuracy_score(test_generator.classes, resnet_pred_classes)

print(f"\n✓ ResNet50V2 Accuracy: {resnet_accuracy*100:.2f}%")

# Evaluate Custom CNN
print("\n" + "="*70)
print("EVALUATING CUSTOM CNN MODEL")
print("="*70)

test_generator.reset()
custom_preds = custom_model.predict(test_generator, verbose=1)
custom_pred_classes = np.argmax(custom_preds, axis=1)
custom_accuracy = accuracy_score(test_generator.classes, custom_pred_classes)

print(f"\n✓ Custom CNN Accuracy: {custom_accuracy*100:.2f}%")

# Evaluate Meta Model (Ensemble)
print("\n" + "="*70)
print("EVALUATING META MODEL (ENSEMBLE)")
print("="*70)

print("Combining predictions from both models...")
# Meta model expects combined predictions from both models
combined_preds = np.column_stack((resnet_preds, custom_preds))
print(f"Combined predictions shape: {combined_preds.shape}")

meta_preds = meta_model.predict(combined_preds, verbose=1)
meta_pred_classes = np.argmax(meta_preds, axis=1)
meta_accuracy = accuracy_score(test_generator.classes, meta_pred_classes)

print(f"\n✓ Meta Model Accuracy: {meta_accuracy*100:.2f}%")

# Accuracy Summary
print("\n" + "="*70)
print("ACCURACY SUMMARY")
print("="*70)

accuracies = {
    "ResNet50V2": resnet_accuracy,
    "Custom CNN": custom_accuracy,
    "Meta Model": meta_accuracy
}

print(f"\n{'Model':<20} {'Accuracy':<15} {'Improvement':<15}")
print("-" * 50)
print(f"{'ResNet50V2':<20} {resnet_accuracy*100:>6.2f}%")
print(f"{'Custom CNN':<20} {custom_accuracy*100:>6.2f}%")
improvement = (meta_accuracy - max(resnet_accuracy, custom_accuracy)) * 100
print(f"{'Meta Model (Best)':<20} {meta_accuracy*100:>6.2f}%      {improvement:+.2f}%")

# Detailed Classification Report
print("\n" + "="*70)
print("DETAILED CLASSIFICATION REPORT (META MODEL)")
print("="*70)

report = classification_report(
    test_generator.classes,
    meta_pred_classes,
    target_names=class_labels
)
print("\n" + report)

# Confusion Matrix
print("\n" + "="*70)
print("CONFUSION MATRIX (META MODEL)")
print("="*70)

cm = confusion_matrix(test_generator.classes, meta_pred_classes)
print("\n", cm)

# Save visualizations
try:
    os.makedirs("training_outputs/evaluation", exist_ok=True)
    
    # Confusion Matrix
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", 
                xticklabels=class_labels, 
                yticklabels=class_labels)
    plt.title("Confusion Matrix - Meta Model")
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    plt.savefig("training_outputs/evaluation/confusion_matrix.png", dpi=300)
    print("\n✓ Confusion matrix saved: training_outputs/evaluation/confusion_matrix.png")
    plt.close()
    
    # Accuracy Comparison
    plt.figure(figsize=(10, 6))
    models = ['ResNet50V2', 'Custom CNN', 'Meta Model']
    accs = [resnet_accuracy*100, custom_accuracy*100, meta_accuracy*100]
    colors = ['#3498db', '#e74c3c', '#2ecc71']
    
    bars = plt.bar(models, accs, color=colors)
    plt.ylabel('Accuracy (%)')
    plt.title('Model Accuracy Comparison')
    plt.ylim([0, 100])
    plt.grid(axis='y', alpha=0.3)
    
    for bar in bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.2f}%',
                ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    plt.savefig("training_outputs/evaluation/accuracy_comparison.png", dpi=300)
    print("✓ Accuracy comparison saved: training_outputs/evaluation/accuracy_comparison.png")
    plt.close()
    
except Exception as e:
    print(f"\n⚠️  Could not save plots: {e}")

# Per-Class Accuracy
print("\n" + "="*70)
print("PER-CLASS ACCURACY (META MODEL)")
print("="*70)

for i, class_name in enumerate(class_labels):
    class_mask = test_generator.classes == i
    if np.sum(class_mask) > 0:
        class_acc = accuracy_score(
            test_generator.classes[class_mask],
            meta_pred_classes[class_mask]
        )
        count = np.sum(class_mask)
        print(f"  {class_name:<20} {class_acc*100:>6.2f}%  ({count} images)")

# Final Summary
best_model = max(accuracies, key=accuracies.get)
best_acc = accuracies[best_model] * 100

print("\n" + "="*70)
print("EVALUATION COMPLETE")
print("="*70)
print(f"\n✓ Best Model: {best_model} with {best_acc:.2f}% accuracy")
print(f"✓ Results saved in: training_outputs/evaluation/")
print(f"\nModel Performance Summary:")
print(f"  - ResNet50V2:  {resnet_accuracy*100:.2f}%")
print(f"  - Custom CNN:  {custom_accuracy*100:.2f}%")
print(f"  - Meta Model:  {meta_accuracy*100:.2f}% (Ensemble improves by {improvement:+.2f}%)")
