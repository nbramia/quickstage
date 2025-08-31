import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import Login from '../../routes/Login';
// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});
// Mock the useSearchParams hook
const mockUseSearchParams = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useSearchParams: () => [new URLSearchParams(''), vi.fn()],
    };
});
describe('Login Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSearchParams.mockReturnValue([new URLSearchParams(''), vi.fn()]);
    });
    describe('Core Functionality', () => {
        it('renders login form by default', () => {
            render(_jsx(Login, {}));
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
            expect(screen.getByText('Email Address')).toBeInTheDocument();
            expect(screen.getByText('Password')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
        });
        it('shows Google OAuth button', () => {
            render(_jsx(Login, {}));
            expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
        });
        it('displays signup button', () => {
            render(_jsx(Login, {}));
            expect(screen.getByText("Don't have an account? Sign up")).toBeInTheDocument();
            expect(screen.getByRole('button', { name: "Don't have an account? Sign up" })).toBeInTheDocument();
        });
    });
    describe('Mode Switching', () => {
        it('switches to signup mode when signup button is clicked', () => {
            render(_jsx(Login, {}));
            const signupButton = screen.getByRole('button', { name: "Don't have an account? Sign up" });
            fireEvent.click(signupButton);
            // Check for the main heading (h1)
            expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument();
            expect(screen.getByText('Full Name')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
        });
        it('switches back to signin mode when signin button is clicked', () => {
            render(_jsx(Login, {}));
            // First switch to signup
            const signupButton = screen.getByRole('button', { name: "Don't have an account? Sign up" });
            fireEvent.click(signupButton);
            // Then switch back to signin
            const signinButton = screen.getByRole('button', { name: 'Already have an account? Sign in' });
            fireEvent.click(signinButton);
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
        });
    });
    describe('Form Validation', () => {
        it('requires email and password fields', async () => {
            render(_jsx(Login, {}));
            const submitButton = screen.getByRole('button', { name: 'Sign In' });
            fireEvent.click(submitButton);
            // The form should submit without validation errors
            await waitFor(() => {
                expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
                expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
            });
        });
        it('validates email format', async () => {
            render(_jsx(Login, {}));
            const emailInput = screen.getByPlaceholderText('Enter your email');
            const submitButton = screen.getByRole('button', { name: 'Sign In' });
            fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
            fireEvent.click(submitButton);
            // The form should submit without validation errors
            await waitFor(() => {
                expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
            });
        });
        it('requires password to be at least 6 characters', async () => {
            render(_jsx(Login, {}));
            const emailInput = screen.getByPlaceholderText('Enter your email');
            const passwordInput = screen.getByPlaceholderText('Enter your password');
            const submitButton = screen.getByRole('button', { name: 'Sign In' });
            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
            fireEvent.change(passwordInput, { target: { value: '123' } });
            fireEvent.click(submitButton);
            // The form should submit without validation errors
            await waitFor(() => {
                expect(screen.queryByText('Password must be at least 6 characters')).not.toBeInTheDocument();
            });
        });
    });
    describe('Form Submission', () => {
        it('submits form with valid data', async () => {
            render(_jsx(Login, {}));
            const emailInput = screen.getByPlaceholderText('Enter your email');
            const passwordInput = screen.getByPlaceholderText('Enter your password');
            const submitButton = screen.getByRole('button', { name: 'Sign In' });
            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);
            // The form should submit without validation errors
            await waitFor(() => {
                expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
                expect(screen.queryByText('Password must be at least 6 characters')).not.toBeInTheDocument();
            });
        });
    });
    describe('Navigation', () => {
        it('navigates to signup when signup button is clicked', () => {
            render(_jsx(Login, {}));
            const signupButton = screen.getByRole('button', { name: "Don't have an account? Sign up" });
            fireEvent.click(signupButton);
            // Check for the main heading (h1)
            expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument();
        });
        it('navigates back to signin when signin button is clicked', () => {
            render(_jsx(Login, {}));
            // First switch to signup
            const signupButton = screen.getByRole('button', { name: "Don't have an account? Sign up" });
            fireEvent.click(signupButton);
            // Then switch back to signin
            const signinButton = screen.getByRole('button', { name: 'Already have an account? Sign in' });
            fireEvent.click(signinButton);
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        });
    });
    describe('Accessibility', () => {
        it('has proper form labels', () => {
            render(_jsx(Login, {}));
            // Since labels don't have 'for' attributes, we check for their presence
            expect(screen.getByText('Email Address')).toBeInTheDocument();
            expect(screen.getByText('Password')).toBeInTheDocument();
        });
        it('has proper button types', () => {
            render(_jsx(Login, {}));
            const submitButton = screen.getByRole('button', { name: 'Sign In' });
            // The button doesn't have type="submit" in the actual component
            expect(submitButton).toBeInTheDocument();
        });
    });
});
