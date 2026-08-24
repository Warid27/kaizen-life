import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

describe('web test stack sanity', () => {
  it('renders a component via RTL with jest-dom matchers working', () => {
    render(
      React.createElement(
        'div',
        { role: 'status', 'data-testid': 'sanity-box' },
        'KaizenLife web test stack online',
      ),
    );

    const box = screen.getByTestId('sanity-box');
    expect(box).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('KaizenLife web test stack online');
  });
});
