"use client";
import InferenceForm from "./components/InferenceForm";

const HomePage = () => {
  return (
    <div className="flex flex-col min-h-screen pt-16 bg-gradient-to-b from-gray-900 to-gray-700 text-white">
      <main className="flex-grow flex items-center justify-center p-8">
        <div className="bg-gray-800 shadow-xl rounded-2xl p-10 w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Welcome to NeuroDL
            </h1>
            <p className="text-lg text-gray-300 mb-2">
              AI-powered brain tumor detection with cutting-edge deep learning models
            </p>
            <p className="text-sm text-gray-400">
              Upload an MRI scan to detect and classify brain tumors
            </p>
          </div>

          {/* Main Form */}
          <InferenceForm />

          {/* Info Section */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">Accurate Detection</h3>
              <p className="text-sm text-gray-300">
                Multiple AI models for high accuracy
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">Fast Results</h3>
              <p className="text-sm text-gray-300">
                Get results in seconds
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">Tumor Segmentation</h3>
              <p className="text-sm text-gray-300">
                Visual highlighting of tumor regions
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;