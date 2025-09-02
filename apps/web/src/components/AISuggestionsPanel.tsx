import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface AIChatPanelProps {
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
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing conversation when panel opens
  useEffect(() => {
    if (isVisible && !hasStarted) {
      loadConversation();
    }
  }, [isVisible, snapshotId]);

  const loadConversation = async () => {
    try {
      const response = await api.get(`/api/snapshots/${snapshotId}/ai-chat`);
      if (response?.data?.success && response.data.data?.exists) {
        setMessages(response.data.data.messages.map((msg: any) => ({
          ...msg,
          timestamp: Date.now()
        })));
        setHasStarted(true);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startConversation = async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const response = await api.post(`/api/snapshots/${snapshotId}/ai-chat/start`);
      
      if (response.data.success) {
        const conversationMessages = response.data.data.messages.map((msg: any) => ({
          ...msg,
          timestamp: Date.now()
        }));
        setMessages(conversationMessages);
        setHasStarted(true);
      } else {
        setError(response.data.error || 'Failed to start AI analysis');
      }
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Please try again in an hour.');
      } else if (error.response?.status === 503) {
        setError('AI service is temporarily unavailable. Please try again later.');
      } else {
        setError('Failed to connect to AI service. Please try again.');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post(`/api/snapshots/${snapshotId}/ai-chat/message`, {
        message: inputMessage.trim()
      });

      if (response.data.success) {
        const aiResponse: AIMessage = {
          role: 'assistant',
          content: response.data.data.response,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiResponse]);
      } else {
        setError(response.data.error || 'Failed to get AI response');
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Please try again in an hour.');
      } else if (error.response?.status === 503) {
        setError('AI service is temporarily unavailable. Please try again later.');
      } else {
        setError('Failed to send message. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Basic markdown-like formatting
    return content
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={index} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(2, -2)}</div>;
        }
        if (line.startsWith('- ')) {
          return <div key={index} className="ml-4 mb-1">• {line.slice(2)}</div>;
        }
        if (line.trim() === '') {
          return <div key={index} className="h-2"></div>;
        }
        return <div key={index} className="mb-1">{line}</div>;
      });
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 font-inconsolata">
            🤖 AI UX Assistant
          </h3>
          <p className="text-sm text-gray-600">
            Get expert UI/UX feedback and suggestions
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg font-bold"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {!hasStarted ? (
        /* Welcome Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-4">🎨</div>
          <h4 className="text-xl font-semibold text-gray-900 mb-4">
            AI-Powered UX Analysis
          </h4>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Get instant feedback on your prototype's user experience, accessibility, 
            design patterns, and modern UI best practices. Ask questions and get 
            specific suggestions for improvement.
          </p>
          
          <div className="w-full space-y-3 mb-6 text-sm text-gray-500">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Accessibility & WCAG compliance
            </div>
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Mobile responsiveness analysis
            </div>
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Visual hierarchy & typography
            </div>
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Interactive Q&A with AI expert
            </div>
          </div>

          <button
            onClick={startConversation}
            disabled={isInitializing}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {isInitializing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Analyzing your prototype...
              </div>
            ) : (
              '🚀 Start AI Analysis'
            )}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
              <button 
                onClick={startConversation}
                className="ml-2 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Chat Interface */
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="text-sm leading-relaxed">
                      {formatMessage(message.content)}
                    </div>
                  ) : (
                    <div className="text-sm">{message.content}</div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about accessibility, mobile design, user flow..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                disabled={isLoading}
                maxLength={1000}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="self-end bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span>{inputMessage.length}/1000</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}