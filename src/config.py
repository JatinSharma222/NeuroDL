import os

# Google Cloud Storage configuration
GCS_BUCKET_NAME = 'thunder_wolf_1245'
MODEL_DIR = 'DL_Models'

# Local paths for saving models
LOCAL_MODEL_DIR = 'models'  # Fixed: removed the nested 'models'

# Model file names
RESNET50_MODEL_NAME = 'ResNet50V2.keras'
CUSTOM_MODEL_NAME = 'new_custom_model.keras'
META_MODEL_NAME = 'meta_model.keras'
SEGMENTATION_MODEL_NAME = 'seg_model2.keras'

# Full local paths to the models
RESNET50_MODEL_PATH = os.path.join(LOCAL_MODEL_DIR, RESNET50_MODEL_NAME)
CUSTOM_MODEL_PATH = os.path.join(LOCAL_MODEL_DIR, CUSTOM_MODEL_NAME)
META_MODEL_PATH = os.path.join(LOCAL_MODEL_DIR, META_MODEL_NAME)
SEGMENTATION_MODEL_PATH = os.path.join(LOCAL_MODEL_DIR, SEGMENTATION_MODEL_NAME)

# Inference settings
CLASSIFICATION_IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32

SEGMENTATION_IMAGE_SIZE = (256, 256)

# Google Cloud project key
GCP_PROJECT_KEY = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'path_to_your_project_key.json')