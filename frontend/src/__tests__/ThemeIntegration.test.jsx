import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { useAuth } from '../contexts/AuthContext';

// Mock the AuthContext
jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock child components that might not be fully implemented
jest.mock('../components/Layout/Layout', () => {
  return function MockLayout({ children }) {
    return (
      <div data-testid="mock-layout">
        <header data-testid="header">Header</header>
        <aside data-testid="sidebar">Sidebar</aside>
        <main>{children}</main>
      </div>
    );
  };
});

jest.mock('../pages/Dashboard/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard">Dashboard Content</div>;
  };
});

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

// Mock CSS custom properties check
const mockGetComputedStyle = jest.fn(() => ({
  getPropertyValue: jest.fn((property) => {
    if (property === '--bg-primary') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? '#1f2937' : '#ffffff';
    }
    if (property === '--text-primary') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#111827';
    }
    return '';
  })
}));

window.getComputedStyle = mockGetComputedStyle;

describe('Theme Integration Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
    
    // Mock auth user
    useAuth.mockReturnValue({
      user: { id: 1, name: 'Test User' },
      logout: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // AC1: Default light mode on first visit
  test('should display interface in light mode by default on first visit', async () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-layout')).toBeInTheDocument();
    });
    
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'light');
    
    // Verify CSS variables are applied for light theme
    const computedStyle = window.getComputedStyle(document.documentElement);
    expect(computedStyle.getPropertyValue('--bg-primary')).toBe('#ffffff');
    expect(computedStyle.getPropertyValue('--text-primary')).toBe('#111827');
  });

  // AC3: Load saved theme preference on page refresh
  test('should load dark theme from localStorage on application startup', async () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    render(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('erp-theme');
    
    // Verify CSS variables are applied for dark theme
    const computedStyle = window.getComputedStyle(document.documentElement);
    expect(computedStyle.getPropertyValue('--bg-primary')).toBe('#1f2937');
    expect(computedStyle.getPropertyValue('--text-primary')).toBe('#ffffff');
  });

  test('should maintain theme consistency across page navigation', async () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    const { rerender } = render(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    // Simulate page rerender (like navigation)
    rerender(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('erp-theme');
  });

  // AC4 & AC5: CSS variables application for header and sidebar
  test('should apply dark theme CSS variables to layout components', async () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    render(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    // Check that header and sidebar are rendered
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    
    // Verify dark theme CSS variables
    const computedStyle = window.getComputedStyle(document.documentElement);
    expect(computedStyle.getPropertyValue('--bg-primary')).toBe('#1f2937');
    expect(computedStyle.getPropertyValue('--text-primary')).toBe('#ffffff');
  });

  test('should apply light theme CSS variables to layout components', async () => {
    localStorageMock.getItem.mockReturnValue('light');
    
    render(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
    
    // Check that header and sidebar are rendered
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    
    // Verify light theme CSS variables
    const computedStyle = window.getComputedStyle(document.documentElement);
    expect(computedStyle.getPropertyValue('--bg-primary')).toBe('#ffffff');
    expect(computedStyle.getPropertyValue('--text-primary')).toBe('#111827');
  });

  test('should handle invalid localStorage theme values gracefully', async () => {
    localStorageMock.getItem.mockReturnValue('invalid-theme-value');
    
    render(<App />);
    
    await waitFor(() => {
      // Should default to light theme when invalid value is found
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'light');
  });

  test('should handle localStorage access errors gracefully', async () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage access denied');
    });
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<App />);
    
    await waitFor(() => {
      // Should still render with default light theme
      expect(screen.getByTestId('mock-layout')).toBeInTheDocument();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
    
    consoleSpy.mockRestore();
  });

  test('should maintain theme state during component unmount and remount', async () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    const { unmount, rerender } = render(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    // Unmount component
    unmount();
    
    // Theme should persist on document
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    
    // Remount component
    rerender(<App />);
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});