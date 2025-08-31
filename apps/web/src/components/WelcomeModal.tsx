import React, { useState } from 'react';
import { useTutorial } from '../contexts/TutorialContext';

export default function WelcomeModal() {
  const { shouldShowWelcome, markWelcomeSeen, skipWelcome, startTutorial } = useTutorial();
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!shouldShowWelcome) return null;

  const slides = [
    {
      title: "Welcome to QuickStage! 🚀",
      description: "Share and collaborate on web prototypes instantly",
      features: [
        "Upload HTML, CSS & JavaScript files",
        "Get shareable URLs in seconds",
        "Collect contextual feedback with comments",
        "Organize projects and track versions"
      ],
      image: "🎨"
    },
    {
      title: "Lightning Fast Sharing ⚡",
      description: "From prototype to shareable link in 10 seconds",
      features: [
        "Drag & drop file upload",
        "Beautiful, professional URLs",
        "Mobile-responsive viewing",
        "Password protection available"
      ],
      image: "🔗"
    },
    {
      title: "Collaborative Feedback 💬",
      description: "Get precise feedback with contextual comments",
      features: [
        "Pin comments to specific UI elements",
        "Thread conversations and replies",
        "Attach files and screenshots",
        "Mark issues as resolved"
      ],
      image: "💡"
    },
    {
      title: "Team Organization 📁",
      description: "Keep your prototypes organized and accessible",
      features: [
        "Create projects and folders",
        "Bulk operations on snapshots",
        "Advanced filtering and search",
        "Analytics and usage tracking"
      ],
      image: "📊"
    }
  ];

  const currentSlideData = slides[currentSlide];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const previousSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleGetStarted = () => {
    markWelcomeSeen();
    startTutorial('dashboard-tour');
  };

  const handleSkip = () => {
    skipWelcome();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {currentSlideData?.title}
              </h2>
              <p className="text-gray-600 mt-1">
                {currentSlideData?.description}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Skip tour
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{currentSlideData?.image}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Key Features:
              </h3>
              <ul className="space-y-3">
                {currentSlideData?.features?.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg 
                      className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {currentSlide === slides.length - 1 && (
              <div className="bg-blue-50 rounded-xl p-6">
                <h4 className="font-semibold text-blue-900 mb-3">
                  Ready to get started?
                </h4>
                <p className="text-blue-700 text-sm mb-4">
                  We'll walk you through the dashboard and show you how to create your first prototype.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Dashboard Tour
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {/* Progress indicators */}
            <div className="flex space-x-2">
              {slides.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentSlide 
                      ? 'bg-blue-600' 
                      : index < currentSlide 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex space-x-3">
              <button
                onClick={previousSlide}
                disabled={currentSlide === 0}
                className="px-4 py-2 text-gray-600 disabled:text-gray-400 hover:text-gray-800 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {currentSlide < slides.length - 1 ? (
                <button
                  onClick={nextSlide}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next
                </button>
              ) : (
                <div className="flex space-x-3">
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Get Started! 🎉
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}