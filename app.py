from flask import Flask, request, jsonify
from io import BytesIO
import numpy as np
from PIL import Image
import base64
import os
import time

from src.preprocess import preprocess_classification
from src.inference import inference_segmentation_with_overlay
from src.utils import load_local_model
from src.config import *
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Define model paths - ONLY USE RESNET FOR NOW
classification_model_path = RESNET50_MODEL_PATH
segmentation_model_path = SEGMENTATION_MODEL_PATH

# Global variables for models
classification_model = None
segmentation_model = None

def load_models():
    """Load models"""
    global classification_model, segmentation_model
    
    print("\n" + "="*60)
    print("LOADING MODELS")
    print("="*60)
    
    try:
        print(f"\nLoading ResNet50V2 classification model...")
        classification_model = load_local_model(classification_model_path)
        print(f"✓ Loaded: {classification_model_path}")
        
        print(f"\nLoading segmentation model...")
        segmentation_model = load_local_model(segmentation_model_path)
        print(f"✓ Loaded: {segmentation_model_path}")
        
        print("\n" + "="*60)
        print("ALL MODELS LOADED SUCCESSFULLY!")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ Error loading models: {e}")
        raise

appHasRunBefore = True

@app.before_request
def firstRun():
    """Load models before the first request"""
    global appHasRunBefore
    if appHasRunBefore:
        load_models()
        appHasRunBefore = False

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint"""
    return jsonify({
        "status": "online",
        "service": "NeuroDL Brain Tumor Detection API",
        "version": "1.0.0",
        "model": "ResNet50V2",
        "accuracy": "84.13%",
        "message": "API is running successfully"
    })

@app.route('/health', methods=['GET'])
def health():
    """Detailed health check endpoint"""
    return jsonify({
        "status": "healthy" if classification_model is not None else "unhealthy",
        "models_loaded": {
            "classification_model": classification_model is not None,
            "segmentation_model": segmentation_model is not None
        },
        "timestamp": time.time()
    })

@app.route('/predict', methods=['POST'])
def predict_image():
    """Main prediction endpoint using ResNet50V2 (84.13% accuracy)"""
    try:
        if 'image' not in request.files:
            return jsonify({
                "error": "No image provided",
                "message": "Please upload an image file with key 'image'"
            }), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({
                "error": "Empty filename"
            }), 400
        
        print(f"\n[PREDICTION REQUEST] Processing: {file.filename}")
        
        image_bytes = file.read()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        
        # Preprocess
        preprocessed_image = preprocess_classification(image_np)
        
        # Predict using ResNet50V2 ONLY
        print("Running ResNet50V2 prediction...")
        predictions = classification_model.predict(preprocessed_image, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][predicted_class])
        
        # Class names
        class_names = {
            0: "Glioma Tumor",
            1: "Meningioma Tumor",
            2: "No Tumor",
            3: "Pituitary Tumor"
        }
        
        class_name = class_names.get(predicted_class, "Unknown")
        
        print(f"Prediction: {predicted_class} ({class_name}) - Confidence: {confidence:.2%}")
        
        # Prepare response
        response = {
            "final_class": predicted_class,
            "class_name": class_name,
            "confidence": f"{confidence:.2%}",
            "model_used": "ResNet50V2",
            "model_accuracy": "84.13%"
        }

        # Segmentation if tumor detected
        if predicted_class != 2:  # Not "No Tumor"
            print("Tumor detected! Performing segmentation...")
            
            try:
                overlayed_image = inference_segmentation_with_overlay(image_np, segmentation_model)
                
                img_io = BytesIO()
                overlayed_image.save(img_io, format='JPEG', quality=95)
                img_io.seek(0)
                img_io_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
                
                response["segment_image"] = img_io_base64
                response["segmentation_performed"] = True
                print("Segmentation complete!")
            except Exception as seg_error:
                print(f"Segmentation failed: {seg_error}")
                response["segmentation_performed"] = False
        else:
            response["segmentation_performed"] = False
            print("No tumor detected. Segmentation skipped.")
        
        print(f"[PREDICTION COMPLETE]\n")
        
        return jsonify(response), 200
    
    except Exception as e:
        print(f"\n[ERROR] Prediction failed: {str(e)}\n")
        return jsonify({
            "error": "Prediction failed",
            "message": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "details": str(error)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    
    print("\n" + "="*60)
    print("NEURODL BRAIN TUMOR DETECTION API")
    print("="*60)
    print(f"Model: ResNet50V2 (Accuracy: 84.13%)")
    print(f"Starting server on port {port}...")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=port, debug=False)