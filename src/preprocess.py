import numpy as np
from skimage.io import imread
from skimage.transform import resize


def preprocess_segmentation(image):
    """
    Preprocess a single image for segmentation, including normalization.

    Args:
        image (np.ndarray): The input image.

    Returns:
        np.ndarray: Preprocessed image ready for segmentation with shape (1, 256, 256, 3).
    """
    print(f'Original image shape: {image.shape}')

    # Resize image
    img = resize(image, (256, 256), mode='constant', preserve_range=True)

    # If the image is grayscale, repeat the channel
    if img.ndim == 2:
        img = np.stack((img,) * 3, axis=-1)

    # Normalize pixel values to [0, 1]
    img = img / 255.0

    # Add a batch dimension
    img = np.expand_dims(img, axis=0)

    print(f'Segmentation image preprocessed. Shape: {img.shape}')
    return img


def preprocess_classification(image):
    """
    Preprocess a single image for classification.

    Args:
        image (np.ndarray): The input image.

    Returns:
        np.ndarray: Preprocessed image ready for classification with shape (1, 128, 128, 3).
    """
    # Resize image to 128x128 (MUST MATCH TRAINING)
    img = resize(image, (128, 128), mode='constant', preserve_range=True)

    # If the image is grayscale, repeat the channel
    if img.ndim == 2:
        img = np.stack((img,) * 3, axis=-1)
    
    # Normalize pixel values to [0, 1]
    img = img / 255.0

    # Add a batch dimension
    img = np.expand_dims(img, axis=0)

    print(f'Classification image preprocessed. Shape: {img.shape}')
    return img


def process_predictions(resnet_preds, custom_preds):
    """
    Process predictions from two classification models and combine them.

    Args:
        resnet_preds (np.ndarray): Predictions from the ResNet model.
        custom_preds (np.ndarray): Predictions from the custom model.

    Returns:
        np.ndarray: Combined predictions stacked side by side.
    """
    # Stack predictions side by side
    combined_preds = np.column_stack((resnet_preds, custom_preds))
    print(f'Combined predictions shape: {combined_preds.shape}')
    
    return combined_preds


# Example usage for testing
if __name__ == "__main__":
    sample_image_seg = np.random.rand(300, 300, 3)
    sample_image_class = np.random.rand(300, 300, 3)
    
    preprocessed_seg_image = preprocess_segmentation(sample_image_seg)
    preprocessed_class_image = preprocess_classification(sample_image_class)
    
    resnet_preds = np.random.rand(10, 4)
    custom_preds = np.random.rand(10, 4)
    
    combined_predictions = process_predictions(resnet_preds, custom_preds)
    print(f'Final shape of combined predictions: {combined_predictions.shape}')