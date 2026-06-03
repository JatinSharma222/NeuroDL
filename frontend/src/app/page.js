"use client";
import InferenceForm from "./components/InferenceForm";
import ProtectedRoute from "./components/ProtectedRoute";

const HomePage = () => {
  return (
    <ProtectedRoute>
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

      {/* Stats Section — real numbers from evaluation */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">94.92%</div>
              <div className="text-gray-600 font-medium">ResNet50V2 Accuracy</div>
              <div className="text-gray-400 text-xs mt-1">Fine-tuned on MRI dataset</div>
            </div>
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">96.07%</div>
              <div className="text-gray-600 font-medium">Ensemble Accuracy</div>
              <div className="text-gray-400 text-xs mt-1">Meta-model (ResNet + CNN)</div>
            </div>
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">4</div>
              <div className="text-gray-600 font-medium">Tumor Classes</div>
              <div className="text-gray-400 text-xs mt-1">Glioma · Meningioma · Pituitary · None</div>
            </div>
            <div className="card-flat">
              <div className="text-5xl font-bold text-red-600 mb-2">7K+</div>
              <div className="text-gray-600 font-medium">Training Images</div>
              <div className="text-gray-400 text-xs mt-1">224×224 · 4 balanced classes</div>
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
              <p>Get accurate results in under 3 seconds with our optimized ResNet50V2 pipeline</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3>94.92% Accuracy</h3>
              <p>Fine-tuned ResNet50V2 with ensemble meta-model reaching 96.07% on the test set</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3>Grad-CAM Explainability</h3>
              <p>See exactly which regions drove the prediction with Grad-CAM heatmaps and pseudo-segmentation</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3>Class Probability Chart</h3>
              <p>Full softmax distribution across all 4 classes — not just the top prediction</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3>AI Radiology Report</h3>
              <p>Structured 8-section clinical report via Ollama llama3.1:8b — downloadable as PDF</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3>Patient Management</h3>
              <p>Full patient records with scan history, JWT auth, and per-user data isolation</p>
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
              Our AI identifies and classifies four brain conditions from MRI scans
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

      {/* Model Performance Table */}
      <section className="section bg-gray-50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-black mb-4">Model Performance</h2>
              <p className="text-gray-600">Evaluated on held-out test set (~1,311 images)</p>
            </div>
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                <thead>
                  <tr style={{ background: "var(--color-bg-tertiary)" }}>
                    <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 700, color: "var(--color-text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Model</th>
                    <th style={{ padding: "14px 20px", textAlign: "center", fontWeight: 700, color: "var(--color-text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Val Accuracy</th>
                    <th style={{ padding: "14px 20px", textAlign: "center", fontWeight: 700, color: "var(--color-text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Parameters</th>
                    <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 700, color: "var(--color-text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { model: "ResNet50V2 (frozen)", acc: "82.56%", params: "24.1M", note: "Transfer learning baseline", highlight: false },
                    { model: "ResNet50V2 (fine-tuned)", acc: "94.92%", params: "24.1M", note: "Primary classifier + Grad-CAM", highlight: true },
                    { model: "Custom CNN", acc: "72.48%", params: "1.3M", note: "GlobalAveragePooling2D", highlight: false },
                    { model: "Meta-Model (Ensemble)", acc: "96.07%", params: "0.04M", note: "ResNet + CNN stacked", highlight: true },
                  ].map((row, i) => (
                    <tr key={i} style={{
                      borderTop: "1px solid var(--color-border-light)",
                      background: row.highlight ? "rgba(230,0,35,0.03)" : "white",
                    }}>
                      <td style={{ padding: "14px 20px", fontWeight: row.highlight ? 700 : 400, color: "var(--color-text-primary)" }}>
                        {row.model}
                        {row.highlight && <span style={{ marginLeft: 8, fontSize: "0.7rem", background: "#fee2e2", color: "#dc2626", padding: "2px 7px", borderRadius: 99, fontWeight: 700 }}>BEST</span>}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "center", fontWeight: 700, color: row.highlight ? "var(--color-primary)" : "var(--color-text-primary)" }}>{row.acc}</td>
                      <td style={{ padding: "14px 20px", textAlign: "center", color: "var(--color-text-secondary)" }}>{row.params}</td>
                      <td style={{ padding: "14px 20px", color: "var(--color-text-light)", fontSize: "0.875rem" }}>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="section bg-white">
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
                  for medical diagnosis and treatment decisions. The AI model's predictions must be verified by a medical expert.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="section bg-gray-50">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold text-black mb-6">
                The Technology
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Built on cutting-edge deep learning architectures and trained on thousands of labelled MRI scans
              </p>
            </div>

            <div className="grid-2">
              <div className="info-section">
                <h3>Model Architecture</h3>
                <ul>
                  <li>ResNet50V2 fine-tuned at lr=1e-5</li>
                  <li>Transfer learning from ImageNet</li>
                  <li>Custom CNN with GlobalAveragePooling2D</li>
                  <li>Ensemble Meta-Model (stacked)</li>
                  <li>Grad-CAM at conv5_block3_out (7×7)</li>
                </ul>
              </div>

              <div className="info-section">
                <h3>Training Dataset</h3>
                <ul>
                  <li>~7,023 MRI scans total</li>
                  <li>4 balanced classes</li>
                  <li>80% train / 20% val split</li>
                  <li>Rotation, flip, zoom augmentation</li>
                  <li>224×224 input resolution</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
    </ProtectedRoute>
  );
};

export default HomePage;