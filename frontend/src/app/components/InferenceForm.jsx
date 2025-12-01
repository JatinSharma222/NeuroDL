"use client"
import React from 'react';
import ImageUploader from './ImageUploader';

const InferenceForm = () => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-black mb-4">
          Upload MRI Scan
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Select a sample or upload your own MRI to get instant AI analysis
        </p>
      </div>
      
      <ImageUploader />
    </div>
  );
};

export default InferenceForm;