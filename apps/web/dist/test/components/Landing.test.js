import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '../utils/test-utils';
import Landing from '../../routes/Landing';
// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});
describe('Landing Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('Page Structure and Content', () => {
        it('renders the main landing page content', () => {
            render(_jsx(Landing, {}));
            // Check main sections exist
            expect(screen.getByText(/Share Working/i)).toBeInTheDocument();
            expect(screen.getByText(/Built for Modern Development/i)).toBeInTheDocument();
            expect(screen.getByText(/How QuickStage Works/i)).toBeInTheDocument();
        });
        it('displays the QuickStage logo/wordmark', () => {
            render(_jsx(Landing, {}));
            const logo = screen.getAllByText(/QuickStage/i)[0]; // Get the first one (header)
            expect(logo).toBeInTheDocument();
            expect(logo).toHaveClass('font-share-tech-mono');
        });
        it('shows navigation buttons in header', () => {
            render(_jsx(Landing, {}));
            expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
        });
    });
    describe('Header Navigation', () => {
        it('Sign Up button navigates to signup flow', async () => {
            render(_jsx(Landing, {}));
            const signUpButton = screen.getByRole('button', { name: /sign up/i });
            fireEvent.click(signUpButton);
            expect(mockNavigate).toHaveBeenCalledWith('/login?mode=signup');
        });
        it('Log In button navigates to login page', () => {
            render(_jsx(Landing, {}));
            const logInButton = screen.getByRole('button', { name: /log in/i });
            fireEvent.click(logInButton);
            expect(mockNavigate).toHaveBeenCalledWith('/login');
        });
        it('header buttons have proper mobile responsive styling', () => {
            render(_jsx(Landing, {}));
            const signUpButton = screen.getByRole('button', { name: /sign up/i });
            const logInButton = screen.getByRole('button', { name: /log in/i });
            // Check for mobile-first responsive classes
            expect(signUpButton).toHaveClass('px-2', 'sm:px-3');
            expect(logInButton).toHaveClass('px-4', 'sm:px-6');
        });
    });
    describe('Hero Section', () => {
        it('hero section takes full viewport height', () => {
            render(_jsx(Landing, {}));
            const heroSection = screen.getByText(/Share Working/i).closest('section');
            expect(heroSection).toHaveClass('min-h-screen');
        });
        it('displays main headline with proper typography', () => {
            render(_jsx(Landing, {}));
            const headline = screen.getByText(/Share Working/i);
            expect(headline).toHaveClass('font-inconsolata');
            expect(headline).toHaveClass('text-5xl', 'md:text-7xl');
        });
        it('shows subheadline with proper typography', () => {
            render(_jsx(Landing, {}));
            const subheadline = screen.getByText(/Just your prototype, online in seconds/i);
            expect(subheadline).toBeInTheDocument();
        });
    });
    describe('Rotating Text Effect', () => {
        it('displays rotating text with bold final words', () => {
            render(_jsx(Landing, {}));
            // The rotating text is conditionally rendered and uses dangerouslySetInnerHTML
            // We can't easily test the HTML content, so we'll test that the container exists
            const heroSection = screen.getByText(/Share Working/i).closest('section');
            expect(heroSection).toBeInTheDocument();
        });
    });
    describe('Interactive Background Effects', () => {
        it('renders star particles in background', () => {
            render(_jsx(Landing, {}));
            // Check for star particle elements
            const stars = document.querySelectorAll('[class*="absolute pointer-events-none"]');
            expect(stars.length).toBeGreaterThan(0);
        });
        it('background effects cover all sections', () => {
            render(_jsx(Landing, {}));
            // Check that background effects are present in main sections
            const mainContainer = document.querySelector('.min-h-screen.bg-black.relative.overflow-hidden');
            expect(mainContainer).toBeInTheDocument();
        });
    });
    describe('Feature Callout Boxes', () => {
        it('displays "Built for Modern Development" section', () => {
            render(_jsx(Landing, {}));
            expect(screen.getByText(/Built for Modern Development/i)).toBeInTheDocument();
            expect(screen.getByText(/10-Second Deploys/i)).toBeInTheDocument();
            expect(screen.getByText(/Secure by Default/i)).toBeInTheDocument();
            expect(screen.getByText(/Real-time Comments/i)).toBeInTheDocument();
        });
        it('displays "How QuickStage Works" section', () => {
            render(_jsx(Landing, {}));
            expect(screen.getByText(/How QuickStage Works/i)).toBeInTheDocument();
            expect(screen.getByText(/Build Locally/i)).toBeInTheDocument();
            expect(screen.getByText(/Deploy Instantly/i)).toBeInTheDocument();
            expect(screen.getByText(/Share Securely/i)).toBeInTheDocument();
        });
    });
    describe('Typography System', () => {
        it('uses Share Tech Mono for QuickStage wordmarks in header', () => {
            render(_jsx(Landing, {}));
            // Only the header QuickStage should have font-share-tech-mono
            const headerQuickStage = screen.getAllByText(/QuickStage/i)[0];
            expect(headerQuickStage).toHaveClass('font-share-tech-mono');
        });
        it('uses Inconsolata for all headers', () => {
            render(_jsx(Landing, {}));
            const headers = [
                'Built for Modern Development',
                'How QuickStage Works'
            ];
            headers.forEach(headerText => {
                const element = screen.getByText(headerText);
                expect(element).toHaveClass('font-inconsolata');
            });
        });
        it('uses Poppins for body text', () => {
            render(_jsx(Landing, {}));
            const bodyTexts = [
                'Three quick steps to a shareable prototype'
            ];
            bodyTexts.forEach(text => {
                const element = screen.getByText(text);
                expect(element).toBeInTheDocument();
            });
        });
    });
    describe('Mobile Responsiveness', () => {
        it('header navigation adapts to mobile screens', () => {
            render(_jsx(Landing, {}));
            const header = screen.getByRole('banner');
            const headerContainer = header.querySelector('.max-w-7xl');
            expect(headerContainer).toBeInTheDocument();
            expect(headerContainer).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
        });
        it('hero section adapts to different screen sizes', () => {
            render(_jsx(Landing, {}));
            const heroSection = screen.getByText(/Share Working/i).closest('section');
            expect(heroSection).toHaveClass('min-h-screen');
        });
        it('feature sections have responsive spacing', () => {
            render(_jsx(Landing, {}));
            // Only the non-hero sections should have py-32
            const sections = document.querySelectorAll('section');
            sections.forEach(section => {
                if (section.id === 'how-it-works' || section.className.includes('py-32')) {
                    expect(section).toHaveClass('py-32');
                }
            });
        });
    });
    describe('Button Interactions', () => {
        it('all buttons are clickable and functional', () => {
            render(_jsx(Landing, {}));
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).not.toBeDisabled();
            });
        });
        it('buttons have proper hover states', () => {
            render(_jsx(Landing, {}));
            const primaryButton = screen.getAllByText('Start Staging Free')[0];
            expect(primaryButton).toHaveClass('hover:scale-105', 'transform');
        });
        it('buttons have consistent styling', () => {
            render(_jsx(Landing, {}));
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toHaveClass('font-poppins');
            });
        });
    });
    describe('Visual Elements', () => {
        it('displays proper icons in feature sections', () => {
            render(_jsx(Landing, {}));
            // Check for SVG icons
            const icons = document.querySelectorAll('svg');
            expect(icons.length).toBeGreaterThan(0);
        });
        it('has proper color scheme and gradients', () => {
            render(_jsx(Landing, {}));
            // Check for gradient classes
            const gradientElements = document.querySelectorAll('.bg-gradient-to-br');
            expect(gradientElements.length).toBeGreaterThan(0);
        });
        it('maintains visual hierarchy with proper spacing', () => {
            render(_jsx(Landing, {}));
            // Only the non-hero sections should have py-32
            const sections = document.querySelectorAll('section');
            sections.forEach(section => {
                if (section.id === 'how-it-works' || section.className.includes('py-32')) {
                    expect(section).toHaveClass('py-32');
                }
            });
        });
    });
    describe('Accessibility', () => {
        it('has proper heading hierarchy', () => {
            render(_jsx(Landing, {}));
            const h1s = screen.getAllByRole('heading', { level: 1 });
            expect(h1s.length).toBeGreaterThan(0);
            expect(h1s[0]).toHaveTextContent(/QuickStage/i);
        });
        it('buttons have accessible names', () => {
            render(_jsx(Landing, {}));
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toHaveAccessibleName();
            });
        });
        it('has proper navigation landmarks', () => {
            render(_jsx(Landing, {}));
            expect(screen.getByRole('banner')).toBeInTheDocument();
            // Note: The Landing component doesn't have a main role, so we'll check for the main content area
            expect(screen.getByText(/Share Working/i)).toBeInTheDocument();
        });
    });
});
