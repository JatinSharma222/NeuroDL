# NeuroDL — Brain Tumor Detection

![License](https://img.shields.io/badge/License-MIT-red.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

Advanced deep learning platform for automated brain tumor detection and classification from MRI scans.

**84.13% Classification Accuracy** &nbsp;|&nbsp; **< 3 Second Inference** &nbsp;|&nbsp; **4 Tumor Classes** &nbsp;|&nbsp; **34,000+ Training Scans**


<img width="1710" height="973" alt="Screenshot 2026-03-18 at 9 17 06 PM" src="https://github.com/user-attachments/assets/56fc90b9-1eba-4572-8ea8-0658ba88b44e" />

<img width="1710" height="983" alt="Screenshot 2026-03-18 at 9 17 54 PM" src="https://github.com/user-attachments/assets/0045295e-e5e1-46dd-ac7a-418b2f92184e" />

<img width="1710" height="983" alt="Screenshot 2026-03-18 at 9 18 45 PM" src="https://github.com/user-attachments/assets/45be8091-c9ad-4708-a4d7-11198afa74aa" />


<img width="1710" height="927" alt="Screenshot 2026-03-18 at 9 22 47 PM" src="https://github.com/user-attachments/assets/398e3f56-1c4f-4f1d-90ca-3ebb9cc187e9" />

---

## Features

- **High-Accuracy Detection** — 84.13% accuracy using ResNet50V2 with ImageNet transfer learning
- **Multi-Class Classification** — Detects Glioma, Meningioma, Pituitary tumors, and healthy scans
- **Visual Segmentation** — U-Net architecture highlights tumor regions with pixel-level overlay
- **Sub-3s Inference** — Optimized preprocessing pipeline runs on standard CPU hardware
- **REST API** — Clean JSON API for embedding predictions in external systems
- **Modern Frontend** — Next.js 14 interface with responsive design

---

## Tumor Types

| Type | Classification | Description |
|------|---------------|-------------|
| **Glioma** | Malignant | Arises from glial cells; aggressive growth requiring multi-modal treatment |
| **Meningioma** | Typically Benign | Originates from meningeal layers; ~90% non-cancerous, managed surgically |
| **Pituitary** | Benign Adenoma | Affects hormonal regulation; treated with medication or surgery |
| **No Tumor** | Negative | Healthy brain scan with no detectable abnormal growth |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- 8 GB RAM minimum
- GPU optional (training only)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/neurodl.git
cd neurodl

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Place trained models in the models/ directory
#   models/ResNet50V2.keras
#   models/seg_model2.keras

# Start the Flask server
python app.py
# Runs at http://localhost:5001
```

### Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Configure environment
echo "NEXT_PUBLIC_API_URL=http://localhost:5001" > .env.local

# Start development server
npm run dev
# Runs at http://localhost:3000
```

---

## Model Performance

### Model Comparison

| Model | Accuracy | F1-Score | Parameters | Training Time |
|-------|----------|----------|------------|---------------|
| ResNet50V2 | 84.13% | 0.841 | 23.6 M | 2 – 3 h |
| Custom CNN | 93.20% | 0.925 | 15.2 M | 3 – 4 h |
| **Meta-Model (Ensemble)** | **98.78%** | **0.988** | 0.5 M | 10 min |

### Per-Class Performance — ResNet50V2

| Class | Precision | Recall | F1-Score |
|-------|-----------|--------|----------|
| Glioma | 0.85 | 0.83 | 0.84 |
| Meningioma | 0.84 | 0.86 | 0.85 |
| No Tumor | 0.83 | 0.84 | 0.84 |
| Pituitary | 0.85 | 0.84 | 0.85 |

---

## Architecture

### Inference Pipeline

```
MRI Input
    │
    ▼
Preprocessing (224×224, normalize [0,1])
    │
    ▼
ResNet50V2 — Classification
    │
    ├── No Tumor ──────────────► Return Result
    │
    └── Tumor Detected
            │
            ▼
        U-Net Segmentation
            │
            ▼
        Overlay Generation
            │
            ▼
        Final Result
```

### Technology Stack

**Backend**
- Python 3.10, TensorFlow/Keras, Flask, Flask-CORS
- NumPy, Pillow, scikit-image

**Frontend**
- Next.js 14 (App Router), React 18, Tailwind CSS, Chakra UI

**ML Models**
- ResNet50V2 (Transfer Learning)
- U-Net (Segmentation)
- Custom CNN
- Meta-Model (Ensemble)

---

## Project Structure

```
neurodl/
├── app.py                          # Flask API entry point
├── requirements.txt                # Python dependencies
├── models/                         # Trained model weights
│   ├── ResNet50V2.keras
│   └── seg_model2.keras
├── src/                            # Core Python modules
│   ├── config.py                   # Path & size configuration
│   ├── preprocess.py               # Image preprocessing
│   ├── inference.py                # Model inference helpers
│   └── utils.py                    # Shared utilities
├── data/                           # Dataset directory
│   ├── raw_dataset/
│   └── sample/
├── notebooks/                      # Jupyter notebooks
│   ├── classification_ResNet50.ipynb
│   └── segmentation_model.ipynb
├── frontend/                       # Next.js application
│   └── src/app/
│       ├── components/
│       ├── page.js
│       ├── layout.js
│       └── globals.css
└── training_outputs/               # Saved metrics & plots
```

---

## API Reference

### `GET /`

Health check. Returns service metadata and current model information.

**Response**

```json
{
  "status": "online",
  "service": "NeuroDL Brain Tumor Detection API",
  "version": "1.0.0",
  "model": "ResNet50V2",
  "accuracy": "84.13%"
}
```

---

### `POST /predict`

Analyze an MRI scan. Accepts a multipart form upload with an `image` field (JPG or PNG).

**Request**

```bash
curl -X POST http://localhost:5001/predict \
  -F "image=@scan.jpg"
```

**Response**

```json
{
  "final_class": 1,
  "class_name": "Meningioma Tumor",
  "confidence": "92.45%",
  "model_used": "ResNet50V2",
  "model_accuracy": "84.13%",
  "segmentation_performed": true,
  "segment_image": "<base64-encoded PNG>"
}
```

---

## Training

Arrange the dataset into the expected directory structure, then run the training and evaluation scripts.

```
data/raw_dataset/
├── Training/
│   ├── glioma_tumor/
│   ├── meningioma_tumor/
│   ├── pituitary_tumor/
│   └── no_tumor/
└── Testing/
    └── [same structure]
```

```bash
python train_all_models.py
python evaluate_models.py
```

Evaluation output includes accuracy metrics, a confusion matrix, per-class performance, and visualizations saved to `training_outputs/`.

### Training Configuration

**Classification**

```python
IMAGE_SIZE = 128
BATCH_SIZE = 32
EPOCHS     = 30
OPTIMIZER  = Adam(lr=0.001)
LOSS       = SparseCategoricalCrossentropy
```

**Segmentation**

```python
IMAGE_SIZE = 256
BATCH_SIZE = 8
EPOCHS     = 100
OPTIMIZER  = Adam(lr=0.00005)
LOSS       = DiceLoss
```

---

## Dataset

| Split | Images | Proportion |
|-------|--------|------------|
| Training | 23,800 | 70% |
| Validation | 5,100 | 15% |
| Test | 5,100 | 15% |
| **Total** | **34,000+** | 4 balanced classes |

Images are provided in JPG/PNG format at variable native resolutions. All inputs are resized to 224×224 and normalized to [0, 1] during preprocessing.

---

## Contributing

Contributions are welcome. Please follow the standard fork-and-pull-request workflow:

1. Fork the repository
2. Create a feature branch — `git checkout -b feature/your-feature`
3. Commit your changes with clear, descriptive messages
4. Add tests for new features and update documentation accordingly
5. Open a pull request against `main`

Please ensure the frontend remains responsive and all evaluation scripts pass before submitting.

---

## Medical Disclaimer

> **This application is intended for research and educational purposes only.**
>
> - Not approved by the FDA or any equivalent regulatory body
> - Not validated for clinical diagnosis or screening
> - Not a substitute for evaluation by a qualified healthcare professional
> - All AI predictions must be independently verified by a medical expert

---

## License

This project is released under the [MIT License](LICENSE).

---

## Acknowledgments

- **Dataset** — Brain MRI Images for Brain Tumor Detection
- **Base Model** — ResNet50V2 pre-trained on ImageNet
- **Framework** — TensorFlow / Keras
- **Community** — Open source contributors

---

*NeuroDL — Making brain tumor detection accessible through artificial intelligence.*
