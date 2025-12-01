# NeuroDL - AI Brain Tumor Detection

![License](https://img.shields.io/badge/License-MIT-red.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

**Advanced deep learning platform for automated brain tumor detection and classification from MRI scans.**

🎯 **84.13% Classification Accuracy** | 🚀 **< 3 Second Analysis** | 🔬 **4 Tumor Types Detected**

---

## ✨ Features

- **High-Accuracy Detection**: 84.13% accuracy using ResNet50V2 architecture
- **Multi-Class Classification**: Detects Glioma, Meningioma, Pituitary tumors, and normal scans
- **Visual Segmentation**: U-Net based tumor region highlighting with overlay
- **Lightning Fast**: Results in under 3 seconds
- **Modern UI**: Pinterest-inspired clean aesthetic design
- **REST API**: Easy integration for developers

---

## 🏥 Tumor Types

| Type | Description | Characteristics |
|------|-------------|-----------------|
| **Glioma** | Malignant tumor from glial cells | Aggressive, requires multi-modal treatment |
| **Meningioma** | Usually benign, from brain protective layers | 90% non-cancerous, surgical treatment |
| **Pituitary** | Benign adenoma of pituitary gland | Affects hormones, medication/surgery |
| **No Tumor** | Normal healthy brain scan | No abnormal growths detected |

---

## 🚀 Quick Start

### Prerequisites

```bash
# System Requirements
- Python 3.10+
- Node.js 18+
- 8GB+ RAM
- GPU optional (for training)
```

### Backend Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/neurodl.git
cd neurodl

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Place models in models/ directory
# - ResNet50V2.keras
# - seg_model2.keras

# 5. Start Flask server
python app.py
```

Server runs at `http://localhost:5001`

### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:5001" > .env.local

# 4. Start development server
npm run dev
```

App runs at `http://localhost:3000`

---

## 📊 Model Performance

### Accuracy Metrics

| Model | Accuracy | F1-Score | Parameters | Training Time |
|-------|----------|----------|------------|---------------|
| ResNet50V2 | **84.13%** | 0.841 | 23.6M | 2-3 hours |
| Custom CNN | 93.20% | 0.925 | 15.2M | 3-4 hours |
| Meta Model | 98.78% | 0.988 | 0.5M | 10 minutes |

### Per-Class Performance

| Class | Precision | Recall | F1-Score |
|-------|-----------|--------|----------|
| Glioma | 0.85 | 0.83 | 0.84 |
| Meningioma | 0.84 | 0.86 | 0.85 |
| No Tumor | 0.83 | 0.84 | 0.84 |
| Pituitary | 0.85 | 0.84 | 0.85 |

---

## 🏗️ Architecture

### System Overview

```
┌─────────────┐
│  MRI Input  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Preprocessing  │
│   (224×224)     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  ResNet50V2     │
│  Classification │
└──────┬──────────┘
       │
       ├─── No Tumor ──────────► Result
       │
       └─── Tumor Detected
              │
              ▼
       ┌──────────────┐
       │  U-Net       │
       │  Segmentation│
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Overlay     │
       │  Generation  │
       └──────┬───────┘
              │
              ▼
         Final Result
```

### Technology Stack

**Backend**
- Python 3.10
- TensorFlow/Keras
- Flask + Flask-CORS
- NumPy, Pillow, scikit-image

**Frontend**
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Chakra UI (Toasts)

**ML Models**
- ResNet50V2 (Transfer Learning)
- U-Net (Segmentation)
- Custom CNN
- Meta-Model (Ensemble)

---

## 📁 Project Structure

```
neurodl/
├── app.py                      # Flask API
├── requirements.txt            # Python dependencies
├── models/                     # Trained models
│   ├── ResNet50V2.keras
│   └── seg_model2.keras
├── src/                        # Source code
│   ├── config.py              # Configuration
│   ├── preprocess.py          # Image preprocessing
│   ├── inference.py           # Model inference
│   └── utils.py               # Utilities
├── data/                       # Dataset
│   ├── raw_dataset/
│   └── sample/
├── notebooks/                  # Jupyter notebooks
│   ├── classification_ResNet50.ipynb
│   ├── segmentation_model.ipynb
│   └── ...
├── frontend/                   # Next.js app
│   ├── src/
│   │   └── app/
│   │       ├── components/
│   │       ├── page.js
│   │       ├── layout.js
│   │       └── globals.css
│   ├── package.json
│   └── next.config.js
└── training_outputs/          # Training results
```

---

## 🔌 API Reference

### Endpoints

#### GET /
Health check endpoint

**Response:**
```json
{
  "status": "online",
  "service": "NeuroDL Brain Tumor Detection API",
  "version": "1.0.0",
  "model": "ResNet50V2",
  "accuracy": "84.13%"
}
```

#### POST /predict
Analyze MRI scan

**Request:**
```bash
curl -X POST http://localhost:5001/predict \
  -F "image=@scan.jpg"
```

**Response:**
```json
{
  "final_class": 1,
  "class_name": "Meningioma Tumor",
  "confidence": "92.45%",
  "model_used": "ResNet50V2",
  "model_accuracy": "84.13%",
  "segmentation_performed": true,
  "segment_image": "base64_encoded_image_string"
}
```

---

## 🎨 Design System

### Color Palette

```css
/* Primary Colors */
--color-primary: #E60023        /* Pinterest Red */
--color-secondary: #000000      /* Black */

/* Backgrounds */
--color-bg-primary: #FFFFFF     /* White */
--color-bg-secondary: #F7F7F7   /* Light Gray */
--color-footer: rgb(51, 51, 45) /* Dark Gray */

/* Text */
--color-text-primary: #000000   /* Black */
--color-text-secondary: #5F5F5F /* Gray */
```

### Typography

- **Font**: System fonts (-apple-system, Segoe UI, Roboto)
- **Headings**: Bold, letter-spacing -0.02em
- **Body**: 1.125rem, line-height 1.7

---

## 📚 Dataset

- **Total Images**: 34,000+ MRI scans
- **Training**: 70% (23,800 images)
- **Validation**: 15% (5,100 images)
- **Testing**: 15% (5,100 images)
- **Classes**: 4 (balanced distribution)
- **Format**: JPG, PNG (variable resolution)
- **Preprocessing**: Resize to 224×224, normalize to [0,1]

---

## 🔬 Training

### Train from Scratch

```bash
# Prepare dataset structure
data/
└── raw_dataset/
    ├── Training/
    │   ├── glioma_tumor/
    │   ├── meningioma_tumor/
    │   ├── pituitary_tumor/
    │   └── no_tumor/
    └── Testing/
        └── [same structure]

# Run training
python train_all_models.py

# Evaluate models
python evaluate_models.py
```

### Training Configuration

```python
# Classification
IMAGE_SIZE = 128
BATCH_SIZE = 32
EPOCHS = 30
OPTIMIZER = Adam(lr=0.001)
LOSS = SparseCategoricalCrossentropy

# Segmentation
IMAGE_SIZE = 256
BATCH_SIZE = 8
EPOCHS = 100
OPTIMIZER = Adam(lr=0.00005)
LOSS = DiceLoss
```

---

## 🚀 Deployment

### Docker

```dockerfile
# Backend Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5001
CMD ["python", "app.py"]
```

```dockerfile
# Frontend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel (Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Set environment variable
NEXT_PUBLIC_API_URL=https://your-api-url.com
```

### Railway/Render (Backend)

1. Connect GitHub repository
2. Set start command: `python app.py`
3. Add environment variables
4. Deploy

---

## ⚙️ Configuration

### Backend (src/config.py)

```python
# Model paths
RESNET50_MODEL_PATH = 'models/ResNet50V2.keras'
SEGMENTATION_MODEL_PATH = 'models/seg_model2.keras'

# Image sizes
CLASSIFICATION_IMAGE_SIZE = (224, 224)
SEGMENTATION_IMAGE_SIZE = (256, 256)

# Processing
BATCH_SIZE = 32
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

---

## 🧪 Testing

### Test API

```bash
# Health check
curl http://localhost:5001/

# Prediction
curl -X POST http://localhost:5001/predict \
  -F "image=@test_scan.jpg"
```

### Run Evaluation

```bash
python evaluate_models.py
```

**Output:**
- Accuracy metrics
- Confusion matrix
- Per-class performance
- Visualizations in `training_outputs/`

---

## 🚨 Important Notice

⚠️ **Medical Disclaimer**

This application is for **research and educational purposes only**.

- ❌ Not FDA approved
- ❌ Not for clinical diagnosis
- ❌ Not a substitute for professional medical advice
- ✅ Always consult qualified healthcare professionals
- ✅ Verify AI predictions with medical experts

---

## 📖 Documentation

- **Main README**: This file
- **Frontend**: `frontend/README.md`
- **Dataset**: `data/Readme.md`
- **Notebooks**: `notebooks/Readme.md`
- **API Docs**: See API Reference section above

---

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

**Guidelines:**
- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure responsive design (frontend)

---

## 📝 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2024 NeuroDL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **Dataset**: Brain MRI Images for Brain Tumor Detection
- **Base Model**: ResNet50V2 (ImageNet pre-training)
- **Framework**: TensorFlow/Keras
- **UI Inspiration**: Pinterest design system
- **Community**: Open source contributors

---

## 📬 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/neurodl/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/neurodl/discussions)
- **Email**: your-email@example.com

---

## 🔗 Links

- [Live Demo](https://neurodl.vercel.app)
- [Documentation](https://docs.neurodl.com)
- [API Reference](https://api.neurodl.com/docs)
- [Model Weights](https://huggingface.co/neurodl)

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/neurodl?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/neurodl?style=social)
![GitHub issues](https://img.shields.io/github/issues/yourusername/neurodl)
![GitHub pull requests](https://img.shields.io/github/issues-pr/yourusername/neurodl)

---

**Built with ❤️ for advancing AI in healthcare**

*NeuroDL - Making brain tumor detection accessible through artificial intelligence*