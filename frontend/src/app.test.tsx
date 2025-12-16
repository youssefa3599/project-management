import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(React.createElement(App));
    expect(container).toBeTruthy();
  });

  it('displays project manager content', () => {
    render(React.createElement(App));
    // Add your actual test assertions here based on your App content
    // Example: expect(screen.getByText(/project/i)).toBeInTheDocument();
    
    // For now, just verify the app renders something
    expect(document.body).toBeTruthy();
  });
});