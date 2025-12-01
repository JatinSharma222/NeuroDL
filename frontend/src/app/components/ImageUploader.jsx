"use client";
import React, { useState, useEffect } from 'react';
import APIRequest from './APIRequest';

const ImageUploader = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Sample images (update paths accordingly)
  const sampleImages = [
    "/gg (26).jpg",
    "/image (11).jpg",
    "/p (28).jpg",
    "/gg (498).jpg",
    "/m (7).jpg",
    "/p (131).jpg",
    "/gg (544).jpg",
    "/p (210).jpg",
    "/gg (37).jpg",
    "/p (199).jpg",
    "/image (46).jpg",
    "/gg (340).jpg",
    "/p (374).jpg",
    "/image(200).jpg",
  ];

  // Handle client-side only logic
  useEffect(() => {
    setIsMounted(true);
    
    // Check if mobile on client side only
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      console.log('File selected:', e.target.files[0]);
    }
  };

  const handleImageClick = async (imagePath) => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], 'sample-image.jpg', { type: blob.type });
      setSelectedImage(file);
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  };

  // Show loading state during SSR
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white shadow-lg rounded-lg sm:p-6 border border-gray-200 w-full relative">
          <div className="sm:relative">
            <div className="text-black text-center">
              <div>Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine which images to show based on screen size
  const displayedImages = isMobile ? sampleImages.slice(0, 4) : sampleImages;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg sm:p-6 border border-gray-200 w-full relative">
        <div className="sm:absolute inset-0"></div>

        <div className="sm:relative">
          <div className="text-black text-center">
            <div>Try it out!</div>
            <div className="sm:flex md:flex justify-center sm:p-3">
              {displayedImages.map((image, index) => (
                <div
                  key={index}
                  className="border border-gray-300 rounded-full overflow-hidden shadow-md sm:w-12 sm:h-12 sm:flex items-center justify-center bg-gray-50 cursor-pointer sm:mr-3"
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image}
                    alt={`Sample ${index}`}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Hidden File Input */}
          <label className="sm:block sm:mb-4 cursor-pointer">
            <span className="text-gray-800 sm:text-lg font-semibold sm:mb-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <div className="bg-white shadow-lg rounded-lg sm:p-4 border border-gray-200">
                <APIRequest image={selectedImage} />
              </div>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;