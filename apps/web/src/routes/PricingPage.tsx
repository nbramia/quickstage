import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface PricingPageProps {
  mode?: 'trial' | 'upgrade';
}

export function PricingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Get mode from URL params
  const urlParams = new URLSearchParams(location.search);
  const mode = urlParams.get('mode') || 'upgrade'; // 'trial' or 'upgrade'
  const isTrialMode = mode === 'trial';

  const handlePlanSelect = async (plan: 'monthly' | 'annual') => {
    if (!user) {
      navigate('/');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isTrialMode ? '/billing/start-trial' : '/billing/subscribe';
      const payload = { plan };

      const response = await api.post(endpoint, payload);
      
      if (response.url) {
        // Redirect to Stripe checkout
        window.location.href = response.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Failed to create checkout session:', error);
      alert(`Failed to start checkout: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const monthlyPrice = 6;
  const annualPrice = 60;
  const monthlySavings = Math.round(((monthlyPrice * 12) - annualPrice) / (monthlyPrice * 12) * 100);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-poppins">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 font-inconsolata">
            Choose Your QuickStage Pro Plan
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            {isTrialMode 
              ? "Start your 7-day free trial with either plan - cancel anytime"
              : "Upgrade to QuickStage Pro for unlimited snapshots and features"
            }
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Monthly Plan */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 relative">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 font-inconsolata">Monthly</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">${monthlyPrice}</span>
                <span className="text-gray-500">/month</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Billed monthly</p>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Unlimited snapshots</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Extended expiration times</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Cancel anytime</span>
              </li>
            </ul>

            <button
              onClick={() => handlePlanSelect('monthly')}
              disabled={loading}
              className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : `Choose Monthly`}
            </button>
          </div>

          {/* Annual Plan */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-blue-500 p-8 relative">
            {/* Popular badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Save {monthlySavings}%
              </span>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 font-inconsolata">Annual</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">${annualPrice}</span>
                <span className="text-gray-500">/year</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Billed annually • <span className="text-green-600 font-medium">${monthlyPrice * 12 - annualPrice} savings</span>
              </p>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Everything in Monthly</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">2 months free</span>
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Priority support</span>
              </li>
            </ul>

            <button
              onClick={() => handlePlanSelect('annual')}
              disabled={loading}
              className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : `Choose Annual`}
            </button>
          </div>
        </div>

        {/* Promotion Code Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Have a promotion code?</h3>
            <p className="mt-2 text-sm text-gray-500">
              You can enter it on the next step during checkout
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Trust indicators */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-4">Secure payment powered by Stripe</p>
          <div className="flex justify-center items-center space-x-6">
            <div className="flex items-center text-xs text-gray-400">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              SSL Encrypted
            </div>
            <div className="flex items-center text-xs text-gray-400">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Cancel Anytime
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}