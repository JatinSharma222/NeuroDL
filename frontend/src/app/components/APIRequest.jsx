"use client"
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Loader from './Loader';
import { useToast } from '@chakra-ui/react';

const APIRequest = ({ image }) => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const toast = useToast();

  const tumorInfo = {
    0: {
      name: "Glioma Tumor",
      content: `## Glioma Tumor\n\n**Description**: Aggressive malignant brain tumor from glial cells requiring multi-modal treatment.\n\n**Action**: Consult neurosurgeon and oncologist immediately for personalized treatment plan.\n\n**Implications**: May cause seizures, cognitive difficulties, and functional impairment.`
    },
    1: {
      name: "Meningioma Tumor",
      content: `## Meningioma Tumor\n\n**Description**: Usually benign tumor from protective brain layers. 90% are non-cancerous.\n\n**Action**: Consult neurosurgeon for evaluation. Regular MRI monitoring recommended.\n\n**Implications**: May cause headaches, vision problems, and neurological symptoms if untreated.`
    },
    2: {
      name: "No Tumor",
      content: `## No Tumor Detected\n\n**Description**: No abnormal growths identified. Healthy brain tissue with normal structures.\n\n**Action**: Maintain regular health check-ups as advised by your healthcare provider.\n\n**Note**: If experiencing symptoms, consult your doctor for comprehensive evaluation.`
    },
    3: {
      name: "Pituitary Tumor",
      content: `## Pituitary Tumor\n\n**Description**: Usually benign adenoma affecting pituitary gland and hormone production.\n\n**Action**: Consult endocrinologist for hormonal evaluation and treatment options.\n\n**Implications**: May cause vision changes, hormonal imbalances, and headaches.`
    }
  };

  const sendRequest = async () => {
    const formData = new FormData();
    formData.append('image', image);

    setLoading(true);
    setResponse(null);
    setInfo("");
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const res = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const result = tumorInfo[data.final_class];
      
      if (result) {
        data.class_name = result.name;
        setInfo(result.content);
      }
      
      setResponse(data);

      toast({
        title: "Analysis Complete!",
        description: `Detected: ${result?.name || 'Unknown'}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('Analysis error:', error);
      setResponse({ error: error.message });
      
      toast({
        title: "Analysis Failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 mt-8">
      {/* Analyze Button */}
      <div className="text-center">
        <button
          onClick={sendRequest}
          disabled={loading}
          className={`btn ${loading ? 'btn-disabled' : 'btn-primary'} text-lg px-12 py-4`}
        >
          {loading ? (
            <span className="flex items-center gap-3">
              <Loader />
              <span>Analyzing...</span>
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>Analyze Now</span>
            </span>
          )}
        </button>
      </div>

      {/* Results */}
      {response && !response.error && (
        <div className="fade-in space-y-8">
          {/* Diagnosis Badge */}
          <div className="text-center">
            <div className="result-badge inline-flex">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Diagnosis: {response.class_name}</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
              <span className="badge badge-primary">
                Confidence: {response.confidence}
              </span>
              <span className="badge badge-info">
                Model: {response.model_used}
              </span>
              <span className="badge badge-success">
                Accuracy: {response.model_accuracy}
              </span>
            </div>
          </div>

          {/* Image Comparison */}
          <div className="result-container">
            <div className="result-card">
              <h3 className="text-lg font-bold text-black mb-4">Original MRI</h3>
              <div className="card-image">
                <img src={URL.createObjectURL(image)} alt="Original MRI" />
              </div>
              <p className="text-sm text-gray-600 mt-3">Uploaded scan for analysis</p>
            </div>

            {response.segment_image && (
              <div className="result-card">
                <h3 className="text-lg font-bold text-black mb-4">Tumor Segmentation</h3>
                <div className="card-image">
                  <img src={`data:image/jpeg;base64,${response.segment_image}`} alt="Segmented" />
                </div>
                <p className="text-sm text-gray-600 mt-3">Highlighted tumor region</p>
              </div>
            )}
          </div>

          {/* Detailed Info */}
          {info && (
            <div className="info-section markdown-content">
              <ReactMarkdown>{info}</ReactMarkdown>
            </div>
          )}

          {/* Warning */}
          <div className="alert alert-warning">
            <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-bold mb-1">Important Medical Notice</p>
              <p className="text-sm leading-relaxed">
                This is for research and education only. Not for clinical diagnosis. 
                Always consult qualified healthcare professionals for medical advice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {response && response.error && (
        <div className="alert alert-error">
          <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-bold mb-1">Analysis Error</p>
            <p className="text-sm">{response.error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIRequest;