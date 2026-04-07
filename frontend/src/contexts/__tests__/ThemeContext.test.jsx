import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Test component that uses the theme context
const TestComponent = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="is-dark">{isDark.toString()}</div>
      <button data-testid="toggle-button" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // AC1: Default to light mode on first visit
  test('should default to light mode when no saved theme exists', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'light');
  });

  // AC2: Theme toggle functionality
  test('should toggle between light and dark modes when toggle is clicked', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId('toggle-button');
    const themeDisplay = screen.getByTestId('current-theme');
    const isDarkDisplay = screen.getByTestId('is-dark');

    // Initial state should be light
    expect(themeDisplay).toHaveTextContent('light');
    expect(isDarkDisplay).toHaveTextContent('false');

    // Toggle to dark
    act(() => {
      fireEvent.click(toggleButton);
    });

    expect(themeDisplay).toHaveTextContent('dark');
    expect(isDarkDisplay).toHaveTextContent('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'dark');

    // Toggle back to light
    act(() => {
      fireEvent.click(toggleButton);
    });

    expect(themeDisplay).toHaveTextContent('light');
    expect(isDarkDisplay).toHaveTextContent('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'light');
  });

  // AC3: Load saved theme preference from localStorage
  test('should load dark theme from localStorage on initialization', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('erp-theme');
  });

  test('should load light theme from localStorage on initialization', () => {
    localStorageMock.getItem.mockReturnValue('light');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  // AC6: Rapid toggle handling
  test('should handle rapid theme toggles without corruption', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId('toggle-button');
    const themeDisplay = screen.getByTestId('current-theme');

    // Rapid toggles
    act(() => {
      fireEvent.click(toggleButton); // light -> dark
      fireEvent.click(toggleButton); // dark -> light
      fireEvent.click(toggleButton); // light -> dark
      fireEvent.click(toggleButton); // dark -> light
      fireEvent.click(toggleButton); // light -> dark
    });

    expect(themeDisplay).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('erp-theme', 'dark');
  });

  test('should ignore invalid localStorage values and default to light', () => {
    localStorageMock.getItem.mockReturnValue('invalid-theme');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('should throw error when useTheme is used outside ThemeProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });
});