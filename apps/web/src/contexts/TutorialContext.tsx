import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../api';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  category: 'getting-started' | 'advanced' | 'feature-specific';
  estimatedTime: number; // in minutes
  prerequisites?: string[]; // other tutorial IDs
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'action' | 'highlight' | 'modal';
  target?: string; // CSS selector for highlighting elements
  position?: 'top' | 'bottom' | 'left' | 'right';
  actionRequired?: boolean; // whether user must perform an action
  nextCondition?: string; // condition to auto-advance
}

interface OnboardingState {
  hasSeenWelcome: boolean;
  completedTutorials: string[];
  welcomeShownAt?: number;
  lastTutorialCompletedAt?: number;
  skippedWelcome?: boolean;
}

interface TutorialContextType {
  // State
  onboarding: OnboardingState | null;
  activeTutorial: Tutorial | null;
  currentStep: number;
  isLoading: boolean;
  shouldShowWelcome: boolean;
  
  // Actions
  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  markWelcomeSeen: () => void;
  skipWelcome: () => void;
  trackTutorialEvent: (tutorialId: string, action: 'started' | 'completed' | 'skipped', step?: number) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Tutorial definitions
const TUTORIALS: Tutorial[] = [
  {
    id: 'welcome',
    title: 'Welcome to QuickStage',
    description: 'Learn the basics of sharing and collaborating on web prototypes',
    category: 'getting-started',
    estimatedTime: 3,
    steps: [
      {
        id: 'welcome-1',
        title: 'Welcome!',
        content: 'QuickStage helps you share web prototypes instantly and collaborate with your team through comments and feedback.',
        type: 'modal',
      },
      {
        id: 'welcome-2',
        title: 'Create Your First Snapshot',
        content: 'Upload your HTML, CSS, and JavaScript files or use our browser extension to capture existing websites.',
        type: 'modal',
      },
      {
        id: 'welcome-3',
        title: 'Share & Collaborate',
        content: 'Get a shareable URL instantly. Team members can view your prototype and leave contextual comments.',
        type: 'modal',
      }
    ]
  },
  {
    id: 'dashboard-tour',
    title: 'Dashboard Tour',
    description: 'Learn how to organize and manage your snapshots',
    category: 'getting-started',
    estimatedTime: 5,
    prerequisites: ['welcome'],
    steps: [
      {
        id: 'dashboard-1',
        title: 'Your Snapshots',
        content: 'This table shows all your uploaded snapshots. You can sort, filter, and search to find specific prototypes.',
        type: 'highlight',
        target: '[data-testid="snapshot-table"]',
        position: 'top',
      },
      {
        id: 'dashboard-2',
        title: 'Project Organization',
        content: 'Use projects to organize your snapshots by client, feature, or team. Create folders to keep things tidy.',
        type: 'highlight',
        target: '[data-testid="project-sidebar"]',
        position: 'right',
      },
      {
        id: 'dashboard-3',
        title: 'Bulk Operations',
        content: 'Select multiple snapshots to perform bulk operations like moving to projects or extending expiry dates.',
        type: 'info',
      }
    ]
  },
  {
    id: 'comments-tutorial',
    title: 'Commenting System',
    description: 'Learn how to use contextual comments for feedback',
    category: 'feature-specific',
    estimatedTime: 4,
    steps: [
      {
        id: 'comments-1',
        title: 'Contextual Comments',
        content: 'Click anywhere on your prototype to leave contextual feedback pinned to specific elements.',
        type: 'info',
      },
      {
        id: 'comments-2',
        title: 'Comment Threads',
        content: 'Start conversations with threaded replies and mark issues as resolved when fixed.',
        type: 'info',
      },
      {
        id: 'comments-3',
        title: 'File Attachments',
        content: 'Attach images, documents, or design files to provide additional context to your feedback.',
        type: 'info',
      }
    ]
  }
];

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);

  // Load onboarding state when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setOnboarding(null);
      setShouldShowWelcome(false);
      return;
    }

    loadOnboardingState();
  }, [isAuthenticated, user]);

  const loadOnboardingState = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/onboarding');
      if (response.success) {
        setOnboarding(response.data);
        
        // Check if should show welcome
        const welcomeResponse = await api.get('/api/onboarding/should-show-welcome');
        if (welcomeResponse.success) {
          setShouldShowWelcome(welcomeResponse.data.shouldShow);
        }
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOnboardingState = async (updates: Partial<OnboardingState>) => {
    try {
      const response = await api.put('/api/onboarding', updates);
      if (response.success) {
        setOnboarding(response.data);
      }
    } catch (error) {
      console.error('Failed to update onboarding state:', error);
    }
  };

  const startTutorial = (tutorialId: string) => {
    const tutorial = TUTORIALS.find(t => t.id === tutorialId);
    if (!tutorial) return;

    setActiveTutorial(tutorial);
    setCurrentStep(0);
    trackTutorialEvent(tutorialId, 'started');
  };

  const nextStep = () => {
    if (!activeTutorial) return;
    
    if (currentStep < activeTutorial.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Tutorial completed
      completeTutorial();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    if (!activeTutorial) return;
    
    trackTutorialEvent(activeTutorial.id, 'skipped', currentStep);
    setActiveTutorial(null);
    setCurrentStep(0);
  };

  const completeTutorial = async () => {
    if (!activeTutorial || !onboarding) return;

    const tutorialId = activeTutorial.id;
    trackTutorialEvent(tutorialId, 'completed');

    // Update completed tutorials
    const updatedTutorials = [...onboarding.completedTutorials, tutorialId];
    await updateOnboardingState({ completedTutorials: updatedTutorials });

    setActiveTutorial(null);
    setCurrentStep(0);
  };

  const markWelcomeSeen = async () => {
    if (!onboarding) return;
    
    await updateOnboardingState({ hasSeenWelcome: true });
    setShouldShowWelcome(false);
  };

  const skipWelcome = async () => {
    if (!onboarding) return;
    
    await updateOnboardingState({ skippedWelcome: true });
    setShouldShowWelcome(false);
  };

  const trackTutorialEvent = async (tutorialId: string, action: 'started' | 'completed' | 'skipped', step?: number) => {
    try {
      await api.post('/api/onboarding/tutorial', {
        tutorialId,
        action,
        step
      });
    } catch (error) {
      console.error('Failed to track tutorial event:', error);
    }
  };

  const value: TutorialContextType = {
    onboarding,
    activeTutorial,
    currentStep,
    isLoading,
    shouldShowWelcome,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    markWelcomeSeen,
    skipWelcome,
    trackTutorialEvent
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

// Export tutorials for reference
export { TUTORIALS };