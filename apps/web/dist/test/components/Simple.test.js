import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, screen } from '../utils/test-utils';
describe('Simple Test', () => {
    it('renders a simple component', () => {
        const TestComponent = () => _jsx("div", { children: "Hello World" });
        render(_jsx(TestComponent, {}));
        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
    it('can find elements by role', () => {
        const TestComponent = () => (_jsxs("div", { children: [_jsx("button", { children: "Click me" }), _jsx("h1", { children: "Title" })] }));
        render(_jsx(TestComponent, {}));
        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByRole('heading')).toBeInTheDocument();
    });
});
