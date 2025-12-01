from flask import Flask, request, jsonify
from flask_cors import CORS
from io import BytesIO
import numpy as np
from PIL import Image
import base64
import os

from src.preprocess import preprocess_classification
from src.inference import inference_segmentation_with_overlay
from src.utils import load_local_model
from src.config import RESNET50_MODEL_PATH, SEGMENTATION_MODEL_PATH

app = Flask(__name__)
CORS(app)

# Global model variables
classification_model = None
segmentation_model = None

def load_models():
    """Load ML models on startup"""
    global classification_model, segmentation_model
    
    print("\n" + "="*60)
    print("LOADING MODELS")
    print("="*60)
    
    try:
        print(f"\nLoading classification model...")
        classification_model = load_local_model(RESNET50_MODEL_PATH)
        print(f"✓ Classification model loaded")
        
        print(f"\nLoading segmentation model...")
        segmentation_model = load_local_model(SEGMENTATION_MODEL_PATH, custom_loss=True)
        print(f"✓ Segmentation model loaded")
        
        print("\n" + "="*60)
        print("ALL MODELS LOADED SUCCESSFULLY")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ Error loading models: {e}")
        raise

app_initialized = False

@app.before_request
def initialize():
    """Initialize models before first request"""
    global app_initialized
    if not app_initialized:
        load_models()
        app_initialized = True

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint"""
    return jsonify({
        "status": "online",
        "service": "NeuroDL Brain Tumor Detection API",
        "version": "1.0.0",
        "model": "ResNet50V2",
        "accuracy": "84.13%"
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Main prediction endpoint"""
    try:
        if 'image' not in request.files:
            return jsonify({
                "error": "No image provided",
                "message": "Please upload an image file"
            }), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        print(f"\n[PREDICTION] Processing: {file.filename}")
        
        # Read and process image
        image_bytes = file.read()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        
        # Preprocess and predict
        preprocessed_image = preprocess_classification(image_np)
        predictions = classification_model.predict(preprocessed_image, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][predicted_class])
        
        # Class mapping
        class_names = {
            0: "Glioma Tumor",
            1: "Meningioma Tumor",
            2: "No Tumor",
            3: "Pituitary Tumor"
        }
        
        class_name = class_names.get(predicted_class, "Unknown")
        
        print(f"Result: {class_name} - Confidence: {confidence:.2%}")
        
        response = {
            "final_class": predicted_class,
            "class_name": class_name,
            "confidence": f"{confidence:.2%}",
            "model_used": "ResNet50V2",
            "model_accuracy": "84.13%",
            "segmentation_performed": False
        }

        # Perform segmentation if tumor detected
        if predicted_class != 2:
            print("Performing segmentation...")
            
            try:
                overlayed_image = inference_segmentation_with_overlay(image_np, segmentation_model)
                
                img_io = BytesIO()
                overlayed_image.save(img_io, format='JPEG', quality=95)
                img_io.seek(0)
                img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
                
                response["segment_image"] = img_base64
                response["segmentation_performed"] = True
                print("Segmentation complete")
            except Exception as seg_error:
                print(f"Segmentation failed: {seg_error}")
        else:
            print("No tumor - segmentation skipped")
        
        print(f"[COMPLETE]\n")
        
        return jsonify(response), 200
    
    except Exception as e:
        print(f"\n[ERROR] {str(e)}\n")
        return jsonify({
            "error": "Prediction failed",
            "message": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    
    print("\n" + "="*60)
    print("NEURODL API SERVER")
    print("="*60)
    print(f"Port: {port}")
    print(f"Model: ResNet50V2 (84.13% accuracy)")
    print("="*60 + "\n")
    
    app.run(host="0.0.0.0", port=port, debug=False)