"use client";
import InferenceForm from "./components/InferenceForm";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-white">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-red-50 rounded-full text-red-600 text-sm font-semibold mb-8">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              AI-Powered Medical Analysis
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-8 text-black">
              Brain Tumor
              <br />
              Detection
            </h1>
            
            <p className="text-2xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
              Upload an MRI scan and let advanced deep learning analyze and detect brain tumors with precision.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <a href="#analyze" className="btn btn-primary text-lg px-10 py-4">
                Get Started
              </a>
              <a href="#features" className="btn btn-outline text-lg px-10 py-4">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">84.13%</div>
              <div className="text-gray-600 font-medium">Accuracy</div>
            </div>
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">34K+</div>
              <div className="text-gray-600 font-medium">Training Images</div>
            </div>
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">4</div>
              <div className="text-gray-600 font-medium">Tumor Classes</div>
            </div>
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">&lt;3s</div>
              <div className="text-gray-600 font-medium">Analysis Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section bg-white">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-black mb-6">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              State-of-the-art AI technology for accurate brain tumor detection and classification
            </p>
          </div>

          <div className="grid-3">
            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3>Lightning Fast</h3>
              <p>Get accurate results in under 3 seconds with our optimized neural network</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3>High Accuracy</h3>
              <p>84.13% classification accuracy using ResNet50V2 architecture</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3>Visual Segmentation</h3>
              <p>See highlighted tumor regions with advanced U-Net segmentation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Analysis Section */}
      <section id="analyze" className="section bg-gray-50">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold text-black mb-6">
                Try It Yourself
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Upload an MRI scan or select a sample to see instant AI-powered analysis
              </p>
            </div>
            
            <div className="card">
              <InferenceForm />
            </div>
          </div>
        </div>
      </section>

      {/* Detection Types */}
      <section className="section bg-white">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-black mb-6">
              What We Detect
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our AI can identify and classify four types of brain conditions
            </p>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 className="text-2xl font-bold text-black mb-4">Glioma Tumor</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Aggressive malignant tumor originating from glial cells. Requires multi-modal treatment including surgery, radiation, and chemotherapy.
              </p>
              <div className="badge badge-primary">Malignant</div>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-black mb-4">Meningioma Tumor</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Usually benign tumor from protective brain layers. 90% are non-cancerous and can often be treated with surgery alone.
              </p>
              <div className="badge badge-success">Often Benign</div>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-black mb-4">Pituitary Tumor</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Typically benign adenoma of the pituitary gland. Can affect hormone production and may require medication or surgery.
              </p>
              <div className="badge badge-success">Usually Benign</div>
            </div>

            <div className="card">
              <h3 className="text-2xl font-bold text-black mb-4">No Tumor</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Normal brain scan with no abnormal growths detected. Healthy brain tissue with normal anatomical structures.
              </p>
              <div className="badge badge-info">Healthy</div>
            </div>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="section bg-gray-50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="alert alert-warning">
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-bold text-lg mb-2">Important Medical Notice</h4>
                <p className="leading-relaxed">
                  This tool is for research and educational purposes only. It is not intended for clinical diagnosis 
                  and should not replace professional medical advice. Always consult qualified healthcare professionals 
                  for medical diagnosis and treatment decisions. The AI model's predictions should be verified by medical experts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="section bg-white">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold text-black mb-6">
                The Technology
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Built on cutting-edge deep learning architectures and trained on thousands of medical images
              </p>
            </div>

            <div className="grid-2">
              <div className="info-section">
                <h3>Model Architecture</h3>
                <ul>
                  <li>ResNet50V2 Base Model</li>
                  <li>Transfer Learning from ImageNet</li>
                  <li>U-Net Segmentation Network</li>
                  <li>Ensemble Meta-Model</li>
                  <li>Custom CNN Classifier</li>
                </ul>
              </div>

              <div className="info-section">
                <h3>Training Dataset</h3>
                <ul>
                  <li>34,000+ MRI Scans</li>
                  <li>4 Balanced Classes</li>
                  <li>70% Training / 30% Testing</li>
                  <li>Data Augmentation Applied</li>
                  <li>Medical Expert Validated</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;