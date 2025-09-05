import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../utils/test-utils';

describe('Simple Test', () => {
  it('renders a simple component', () => {
    const TestComponent = () => <div>Hello World</div>;
    render(<TestComponent />);
    
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('can find elements by role', () => {
    const TestComponent = () => (
      <div>
        <button>Click me</button>
        <h1>Title</h1>
      </div>
    );
    
    render(<TestComponent />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});
