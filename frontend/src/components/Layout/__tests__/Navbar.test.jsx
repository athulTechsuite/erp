import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar, { ThemeToggleProvider } from '../Navbar';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

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

// Mock Material-UI components that might cause issues
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: jest.fn(() => ({ breakpoints: { down: jest.fn(() => false) } })),
  useMediaQuery: jest.fn(() => false)
}));

const renderNavbarWithProviders = (initialTheme = null) => {
  if (initialTheme) {
    localStorageMock.getItem.mockReturnValue(initialTheme);
  } else {
    localStorageMock.getItem.mockReturnValue(null);
  }

  const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
  useAuth.mockReturnValue({
    user: mockUser,
    logout: jest.fn()
  });

  return render(
    <BrowserRouter>
      <ThemeToggleProvider>
        <Navbar />
      </ThemeToggleProvider>
    </BrowserRouter>
  );
};

describe('Navbar Theme Toggle', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // AC1: Default to light mode on first visit
  test('should initialize with light mode when no saved preference exists', () => {
    renderNavbarWithProviders();
    
    const themeToggleButton = screen.getByRole('button', { name: /toggle theme/i });
    expect(themeToggleButton).toBeInTheDocument();
    
    // Check that light mode icon is displayed (assuming LightModeIcon is shown for light theme)
    expect(screen.getByTestId('LightModeIcon') || screen.getByLabelText(/light mode/i)).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'light');
  });

  // AC2: Theme toggle with icon change
  test('should toggle theme and change icon when clicked', async () => {
    renderNavbarWithProviders();
    
    const themeToggleButton = screen.getByRole('button', { name: /toggle theme/i });
    
    // Initially should be light mode
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    
    // Click to switch to dark mode
    act(() => {
      fireEvent.click(themeToggleButton);
    });
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    // Check that dark mode icon is now displayed
    expect(screen.getByTestId('DarkModeIcon') || screen.getByLabelText(/dark mode/i)).toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'dark');
    
    // Click again to switch back to light mode
    act(() => {
      fireEvent.click(themeToggleButton);
    });
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
    
    expect(screen.getByTestId('LightModeIcon') || screen.getByLabelText(/light mode/i)).toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('erp-theme', 'light');
  });

  // AC3: Load saved theme preference
  test('should load dark theme from localStorage on initialization', () => {
    renderNavbarWithProviders('dark');
    
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByTestId('DarkModeIcon') || screen.getByLabelText(/dark mode/i)).toBeInTheDocument();
    expect(localStorageMock.getItem).toHaveBeenCalledWith('erp-theme');
  });

  test('should load light theme from localStorage on initialization', () => {
    renderNavbarWithProviders('light');
    
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByTestId('LightModeIcon') || screen.getByLabelText(/light mode/i)).toBeInTheDocument();
  });

  // AC6: Rapid toggle handling
  test('should handle rapid theme toggles correctly', async () => {
    renderNavbarWithProviders();
    
    const themeToggleButton = screen.getByRole('button', { name: /toggle theme/i });
    
    // Perform rapid clicks
    act(() => {
      fireEvent.click(themeToggleButton); // light -> dark
      fireEvent.click(themeToggleButton); // dark -> light
      fireEvent.click(themeToggleButton); // light -> dark
      fireEvent.click(themeToggleButton); // dark -> light
      fireEvent.click(themeToggleButton); // light -> dark
    });
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
    
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('erp-theme', 'dark');
    expect(screen.getByTestId('DarkModeIcon') || screen.getByLabelText(/dark mode/i)).toBeInTheDocument();
  });

  test('should maintain theme consistency during rapid toggles', async () => {
    renderNavbarWithProviders();
    
    const themeToggleButton = screen.getByRole('button', { name: /toggle theme/i });
    
    // Rapid toggles with delays to test state consistency
    for (let i = 0; i < 10; i++) {
      act(() => {
        fireEvent.click(themeToggleButton);
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // After 10 toggles (even number), should be back to light mode
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
    
    expect(screen.getByTestId('LightModeIcon') || screen.getByLabelText(/light mode/i)).toBeInTheDocument();
  });

  test('should handle localStorage errors gracefully', () => {
    // Mock localStorage.setItem to throw an error
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderNavbarWithProviders();
    
    const themeToggleButton = screen.getByRole('button', { name: /toggle theme/i });
    
    // Theme should still toggle even if localStorage fails
    act(() => {
      fireEvent.click(themeToggleButton);
    });
    
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    
    consoleSpy.mockRestore();
  });
});