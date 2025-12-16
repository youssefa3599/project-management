import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe.skip('Debug Tests', () => {
  it('checks JSX runtime availability', () => {
    console.log('=== JSX RUNTIME DEBUG ===');
    console.log('✅ React imported');
    console.log('React keys:', Object.keys(React));
    console.log('React.createElement:', typeof React.createElement);
    expect(true).toBe(true);
  });

  it('tests simple component rendering', () => {
    console.log('=== SIMPLE COMPONENT TEST ===');
    
    const SimpleComponent = (): React.ReactElement => {
      console.log('SimpleComponent rendering...');
      return React.createElement('div', { 'data-testid': 'simple' }, 'Hello');
    };
    
    console.log('About to render SimpleComponent...');
    try {
      const { container } = render(React.createElement(SimpleComponent));
      console.log('✅ Render successful!');
      console.log('Container HTML:', container.innerHTML);
      
      const element = screen.getByTestId('simple');
      expect(element).toBeInTheDocument();
      expect(element).toHaveTextContent('Hello');
      console.log('✅ All assertions passed!');
    } catch (e) {
      console.error('❌ Render failed:', e);
      throw e;
    }
  });
});