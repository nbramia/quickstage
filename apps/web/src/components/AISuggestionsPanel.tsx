import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface AISuggestion {
  id: string;
  snapshotId: string;
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  category: 'accessibility' | 'usability' | 'design' | 'performance' | 'mobile';
  elementSelector?: string;
  elementCoordinates?: { x: number; y: number; };
  actionable: boolean;
  actionSteps?: string[];
  exampleCode?: string;
  resources?: Array<{ title: string; url: string; type: string; }>;
  confidence: number;
  generatedAt: number;
  status: 'active' | 'applied' | 'dismissed';
  userFeedback?: 'helpful' | 'not_helpful' | 'neutral';
}

interface AISuggestionsAnalysis {
  snapshotId: string;
  totalSuggestions: number;
  suggestionsByCategory: Record<string, number>;
  suggestionsBySeverity: Record<string, number>;
  overallScore: number;
  lastAnalyzedAt: number;
  analysisVersion: string;
}

interface AISuggestionsPanelProps {
  snapshotId: string;
  isVisible: boolean;
  onClose: () => void;
  className?: string;
}

export default function AISuggestionsPanel({ 
  snapshotId, 
  isVisible, 
  onClose, 
  className = '' 
}: AISuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [analysis, setAnalysis] = useState<AISuggestionsAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);

  useEffect(() => {
    if (isVisible && snapshotId) {
      loadSuggestions();
    }
  }, [isVisible, snapshotId]);

  const loadSuggestions = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/snapshots/${snapshotId}/ai-suggestions`);
      
      if (response.success && response.data) {
        setSuggestions(response.data.suggestions || []);
        setAnalysis(response.data.analysis);
      } else {
        setSuggestions([]);
        setAnalysis(null);
      }
    } catch (error) {
      console.error('Failed to load AI suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      setIsGenerating(true);
      const response = await api.post(`/api/snapshots/${snapshotId}/ai-suggestions/generate`);
      
      if (response.success && response.data) {
        setSuggestions(response.data.suggestions);
        setAnalysis(response.data.analysis);
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSuggestionStatus = async (suggestionId: string, status: 'applied' | 'dismissed', feedback?: string) => {
    try {
      await api.put(`/api/snapshots/${snapshotId}/ai-suggestions/${suggestionId}`, {
        status,
        feedback
      });

      // Update local state
      setSuggestions(prev => prev.map(suggestion => 
        suggestion.id === suggestionId 
          ? { ...suggestion, status, userFeedback: feedback as any }
          : suggestion
      ));
    } catch (error) {
      console.error('Failed to update suggestion status:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-orange-600 bg-orange-100';
      case 'low': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'accessibility': return '♿';
      case 'usability': return '🎯';
      case 'design': return '🎨';
      case 'performance': return '⚡';
      case 'mobile': return '📱';
      default: return '💡';
    }
  };

  const filteredSuggestions = suggestions.filter(suggestion => {
    if (filter === 'all') return true;
    if (filter === 'active') return suggestion.status === 'active';
    return suggestion.category === filter;
  });

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-lg z-40 overflow-y-auto ${className}`}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-2">🤖</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Suggestions</h2>
              {analysis && (
                <p className="text-sm text-gray-500">
                  UX Score: <span className="font-medium">{analysis.overallScore}/100</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Generate Button */}
        {suggestions.length === 0 && !isLoading && (
          <button
            onClick={generateSuggestions}
            disabled={isGenerating}
            className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Analyzing...' : 'Generate AI Suggestions'}
          </button>
        )}

        {/* Filters */}
        {suggestions.length > 0 && (
          <div className="mt-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Suggestions ({suggestions.length})</option>
              <option value="active">Active ({suggestions.filter(s => s.status === 'active').length})</option>
              <option value="accessibility">Accessibility ({suggestions.filter(s => s.category === 'accessibility').length})</option>
              <option value="usability">Usability ({suggestions.filter(s => s.category === 'usability').length})</option>
              <option value="design">Design ({suggestions.filter(s => s.category === 'design').length})</option>
              <option value="performance">Performance ({suggestions.filter(s => s.category === 'performance').length})</option>
              <option value="mobile">Mobile ({suggestions.filter(s => s.category === 'mobile').length})</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!isLoading && suggestions.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Suggestions Yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Generate AI-powered UX suggestions to improve your prototype's usability and accessibility.
            </p>
          </div>
        )}

        {/* Analysis Summary */}
        {analysis && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Analysis Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Total:</span> {analysis.totalSuggestions}
              </div>
              <div>
                <span className="text-gray-600">Score:</span> {analysis.overallScore}/100
              </div>
            </div>
          </div>
        )}

        {/* Suggestions List */}
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center">
                  <span className="mr-2">{getCategoryIcon(suggestion.category)}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">
                      {suggestion.title}
                    </h4>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(suggestion.severity)}`}>
                      {suggestion.severity}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {suggestion.description}
              </p>

              {suggestion.actionSteps && suggestion.actionSteps.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-xs font-medium text-gray-700 mb-1">Action Steps:</h5>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {suggestion.actionSteps.slice(0, 2).map((step, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-1">•</span>
                        {step}
                      </li>
                    ))}
                    {suggestion.actionSteps.length > 2 && (
                      <li className="text-blue-600 cursor-pointer" onClick={() => setSelectedSuggestion(suggestion)}>
                        +{suggestion.actionSteps.length - 2} more steps...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              {suggestion.status === 'active' && (
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => updateSuggestionStatus(suggestion.id, 'applied', 'helpful')}
                    className="flex-1 bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700"
                  >
                    Applied ✓
                  </button>
                  <button
                    onClick={() => updateSuggestionStatus(suggestion.id, 'dismissed', 'not_helpful')}
                    className="flex-1 bg-gray-600 text-white text-xs px-3 py-1 rounded hover:bg-gray-700"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {suggestion.status !== 'active' && (
                <div className="text-xs text-gray-500 mt-2">
                  {suggestion.status === 'applied' ? '✓ Applied' : '✕ Dismissed'}
                </div>
              )}

              {/* Confidence Score */}
              <div className="text-xs text-gray-400 mt-2">
                Confidence: {Math.round(suggestion.confidence * 100)}%
              </div>
            </div>
          ))}
        </div>

        {/* Regenerate Button */}
        {suggestions.length > 0 && (
          <button
            onClick={generateSuggestions}
            disabled={isGenerating}
            className="w-full mt-6 border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            {isGenerating ? 'Regenerating...' : 'Regenerate Suggestions'}
          </button>
        )}
      </div>

      {/* Detailed Suggestion Modal */}
      {selectedSuggestion && (
        <SuggestionDetailModal 
          suggestion={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
          onUpdateStatus={updateSuggestionStatus}
        />
      )}
    </div>
  );
}

// Detailed suggestion modal component
function SuggestionDetailModal({ 
  suggestion, 
  onClose, 
  onUpdateStatus 
}: {
  suggestion: AISuggestion;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'applied' | 'dismissed', feedback?: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">{suggestion.title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>

          <p className="text-gray-600 mb-6">{suggestion.description}</p>

          {suggestion.actionSteps && (
            <div className="mb-6">
              <h4 className="font-medium mb-3">How to implement:</h4>
              <ol className="space-y-2">
                {suggestion.actionSteps.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {suggestion.resources && suggestion.resources.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium mb-3">Learn more:</h4>
              <div className="space-y-2">
                {suggestion.resources.map((resource, index) => (
                  <a
                    key={index}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="font-medium text-sm">{resource.title}</div>
                    <div className="text-xs text-blue-600">{resource.type}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {suggestion.status === 'active' && (
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  onUpdateStatus(suggestion.id, 'applied', 'helpful');
                  onClose();
                }}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Mark as Applied
              </button>
              <button
                onClick={() => {
                  onUpdateStatus(suggestion.id, 'dismissed', 'not_helpful');
                  onClose();
                }}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}