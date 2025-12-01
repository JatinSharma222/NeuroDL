"use client";
import React, { useState, useEffect } from 'react';
import APIRequest from './APIRequest';

const ImageUploader = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  const sampleImages = [
    "/gg (26).jpg", "/image (11).jpg", "/p (28).jpg", "/gg (498).jpg",
    "/m (7).jpg", "/p (131).jpg", "/gg (544).jpg", "/p (210).jpg",
    "/gg (37).jpg", "/p (199).jpg", "/image (46).jpg", "/gg (340).jpg"
  ];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleSampleClick = async (imagePath) => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], 'sample.jpg', { type: blob.type });
      setSelectedImage(file);
    } catch (error) {
      console.error('Error loading sample:', error);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sample Images */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-black mb-6">
          Try with Sample Images
        </h3>
        <div className="sample-grid">
          {sampleImages.map((image, index) => (
            <div
              key={index}
              className="sample-image"
              onClick={() => handleSampleClick(image)}
              title={`Sample ${index + 1}`}
            >
              <img
                src={image}
                alt={`Sample ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-black mb-6">
          Or Upload Your Own MRI
        </h3>
        <label className="cursor-pointer block">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="sr-only"
          />
          <div className={`upload-area ${selectedImage ? 'active' : ''}`}>
            {selectedImage ? (
              <div className="fade-in">
                <div className="upload-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-black mb-2">
                  {selectedImage.name}
                </h4>
                <p className="text-gray-600">
                  Click to change image
                </p>
              </div>
            ) : (
              <div>
                <div className="upload-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-black mb-2">
                  Click to Upload MRI Scan
                </h4>
                <p className="text-gray-600">
                  PNG, JPG or JPEG (MAX. 10MB)
                </p>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Analysis Component */}
      {selectedImage && <APIRequest image={selectedImage} />}
    </div>
  );
};

export default ImageUploader;