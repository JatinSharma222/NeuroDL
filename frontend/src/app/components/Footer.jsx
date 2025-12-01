import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-6 border-t border-gray-800">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Left Section */}
          <div className="mb-4 md:mb-0">
            <h4 className="text-xl font-bold text-blue-400">NeuroDL</h4>
            <p className="text-sm text-gray-400 mt-1">
              AI-Powered Brain Tumor Detection
            </p>
          </div>

          {/* Middle Section */}
          <div className="text-center mb-4 md:mb-0">
            <p className="text-sm text-gray-400">
              Deep Learning | Medical Imaging | Healthcare AI
            </p>
          </div>

          {/* Right Section */}
          <div className="text-center md:text-right">
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} NeuroDL
            </p>
            <p className="text-xs text-gray-500 mt-1">
              For research and educational purposes
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;