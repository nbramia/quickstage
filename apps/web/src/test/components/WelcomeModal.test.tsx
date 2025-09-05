import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '../utils/test-utils';
import WelcomeModal from '../../components/WelcomeModal';
import { TutorialProvider } from '../../contexts/TutorialContext';

// Mock the tutorial context
const mockTutorialContext = {
  shouldShowWelcome: false,
  markWelcomeSeen: vi.fn(),
  skipWelcome: vi.fn(),
  startTutorial: vi.fn(),
  onboarding: null,
  activeTutorial: null,
  currentStep: 0,
  isLoading: false,
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  skipTutorial: vi.fn(),
  completeTutorial: vi.fn(),
  trackTutorialEvent: vi.fn(),
};

vi.mock('../../contexts/TutorialContext', () => ({
  TutorialProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTutorial: () => mockTutorialContext,
}));

describe('WelcomeModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders nothing when shouldShowWelcome is false', () => {
      mockTutorialContext.shouldShowWelcome = false;
      render(<WelcomeModal />);
      
      expect(screen.queryByText(/Welcome to QuickStage/)).not.toBeInTheDocument();
    });

    it('renders modal when shouldShowWelcome is true', () => {
      mockTutorialContext.shouldShowWelcome = true;
      render(<WelcomeModal />);
      
      expect(screen.getByText(/Welcome to QuickStage!/)).toBeInTheDocument();
    });
  });

  describe('Slide Navigation', () => {
    beforeEach(() => {
      mockTutorialContext.shouldShowWelcome = true;
    });

    it('shows first slide initially', () => {
      render(<WelcomeModal />);
      
      expect(screen.getByText(/Welcome to QuickStage!/)).toBeInTheDocument();
      expect(screen.getByText(/Share and collaborate on web prototypes instantly/)).toBeInTheDocument();
    });

    it('navigates to next slide when Next button is clicked', () => {
      render(<WelcomeModal />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText(/Lightning Fast Sharing/)).toBeInTheDocument();
    });

    it('navigates to previous slide when Previous button is clicked', () => {
      render(<WelcomeModal />);
      
      // Go to second slide first
      fireEvent.click(screen.getByText('Next'));
      
      // Now go back
      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);
      
      expect(screen.getByText(/Welcome to QuickStage!/)).toBeInTheDocument();
    });

    it('disables Previous button on first slide', () => {
      render(<WelcomeModal />);
      
      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('shows different content on each slide', () => {
      render(<WelcomeModal />);
      
      // Slide 1
      expect(screen.getByText(/Upload HTML, CSS & JavaScript files/)).toBeInTheDocument();
      
      // Go to slide 2
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText(/Drag & drop file upload/)).toBeInTheDocument();
      
      // Go to slide 3
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText(/Pin comments to specific UI elements/)).toBeInTheDocument();
      
      // Go to slide 4
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText(/Create projects and folders/)).toBeInTheDocument();
    });
  });

  describe('Progress Indicators', () => {
    beforeEach(() => {
      mockTutorialContext.shouldShowWelcome = true;
    });

    it('shows progress dots', () => {
      render(<WelcomeModal />);
      
      // Should have 4 progress dots
      const progressDots = document.querySelectorAll('.rounded-full');
      expect(progressDots.length).toBeGreaterThanOrEqual(4);
    });

    it('highlights current slide in progress', () => {
      render(<WelcomeModal />);
      
      const progressDots = document.querySelectorAll('.rounded-full');
      expect(progressDots[0]).toHaveClass('bg-blue-600'); // Current slide
      expect(progressDots[1]).toHaveClass('bg-gray-300'); // Future slide
    });
  });

  describe('Final Slide Actions', () => {
    beforeEach(() => {
      mockTutorialContext.shouldShowWelcome = true;
    });

    it('shows Get Started button on final slide', () => {
      render(<WelcomeModal />);
      
      // Navigate to final slide
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));
      
      expect(screen.getByText(/Get Started! 🎉/)).toBeInTheDocument();
      expect(screen.getByText('Start Dashboard Tour')).toBeInTheDocument();
    });

    it('calls markWelcomeSeen and startTutorial when Get Started is clicked', () => {
      render(<WelcomeModal />);
      
      // Navigate to final slide
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));
      
      const getStartedButton = screen.getByText(/Get Started! 🎉/);
      fireEvent.click(getStartedButton);
      
      expect(mockTutorialContext.markWelcomeSeen).toHaveBeenCalled();
      expect(mockTutorialContext.startTutorial).toHaveBeenCalledWith('dashboard-tour');
    });
  });

  describe('Skip Functionality', () => {
    beforeEach(() => {
      mockTutorialContext.shouldShowWelcome = true;
    });

    it('shows skip tour button', () => {
      render(<WelcomeModal />);
      
      expect(screen.getByText('Skip tour')).toBeInTheDocument();
    });

    it('calls skipWelcome when skip tour is clicked', () => {
      render(<WelcomeModal />);
      
      const skipButton = screen.getByText('Skip tour');
      fireEvent.click(skipButton);
      
      expect(mockTutorialContext.skipWelcome).toHaveBeenCalled();
    });

    it('shows Maybe Later button on final slide', () => {
      render(<WelcomeModal />);
      
      // Navigate to final slide
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));
      
      const maybeLaterButton = screen.getByText('Maybe Later');
      fireEvent.click(maybeLaterButton);
      
      expect(mockTutorialContext.skipWelcome).toHaveBeenCalled();
    });
  });

  describe('Content Display', () => {
    beforeEach(() => {
      mockTutorialContext.shouldShowWelcome = true;
    });

    it('displays feature lists for each slide', () => {
      render(<WelcomeModal />);
      
      // Check that features are displayed as a list
      expect(screen.getByText('Upload HTML, CSS & JavaScript files')).toBeInTheDocument();
      expect(screen.getByText('Get shareable URLs in seconds')).toBeInTheDocument();
      
      // Features should have checkmarks
      const checkmarks = document.querySelectorAll('svg');
      expect(checkmarks.length).toBeGreaterThan(0);
    });

    it('shows correct emojis for each slide', () => {
      render(<WelcomeModal />);
      
      expect(screen.getByText('🎨')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('🔗')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('💡')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByText('📊')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockTutorialContext.shouldShowWelcome = true;
    });

    it('has accessible buttons', () => {
      render(<WelcomeModal />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('has proper heading structure', () => {
      render(<WelcomeModal />);
      
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation', () => {
      render(<WelcomeModal />);
      
      const nextButton = screen.getByText('Next');
      nextButton.focus();
      expect(document.activeElement).toBe(nextButton);
    });
  });
});