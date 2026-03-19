import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AnnouncementWidget from '../AnnouncementWidget';
import { useAuth } from '../../../hooks/useAuth';
import { announcementService } from '../../../services/announcementService';

// Mock dependencies
jest.mock('../../../hooks/useAuth');
jest.mock('../../../services/announcementService');

// Mock UI components
jest.mock('../../ui/card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h2>{children}</h2>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>
}));

jest.mock('../../ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}));

jest.mock('../../ui/input', () => ({
  Input: (props) => <input {...props} />
}));

jest.mock('../../ui/textarea', () => ({
  Textarea: (props) => <textarea {...props} />
}));

jest.mock('../../ui/alert', () => ({
  Alert: ({ children }) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }) => <div>{children}</div>
}));

const mockAnnouncementService = announcementService;
const mockUseAuth = useAuth;

const TestWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('AnnouncementWidget', () => {
  const mockAdminUser = {
    id: 1,
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User'
  };

  const mockEmployeeUser = {
    id: 2,
    role: 'employee',
    firstName: 'John',
    lastName: 'Doe'
  };

  const mockAnnouncements = [
    {
      id: 1,
      title: 'Company Update',
      content: 'Important company news here',
      createdAt: '2024-01-15T10:00:00Z',
      expirationDate: null,
      createdBy: {
        firstName: 'Admin',
        lastName: 'User'
      }
    },
    {
      id: 2,
      title: 'Holiday Notice',
      content: 'Office will be closed for holidays',
      createdAt: '2024-01-14T09:00:00Z',
      expirationDate: '2024-12-25T00:00:00Z',
      createdBy: {
        firstName: 'Admin',
        lastName: 'User'
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnnouncementService.getAll = jest.fn();
    mockAnnouncementService.create = jest.fn();
    mockAnnouncementService.update = jest.fn();
    mockAnnouncementService.delete = jest.fn();
  });

  describe('TC-006: Global Announcement widget appears on admin dashboard', () => {
    it('should render announcement widget for admin users', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Announcements')).toBeInTheDocument();
    });

    it('should display recent announcements in widget', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
        expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
      });
    });

    it('should limit display to 5 most recent announcements', async () => {
      const manyAnnouncements = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Announcement ${i + 1}`,
        content: `Content ${i + 1}`,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        expirationDate: null,
        createdBy: { firstName: 'Admin', lastName: 'User' }
      }));

      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(manyAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const announcementElements = screen.getAllByText(/Announcement \d+/);
        expect(announcementElements.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('TC-007: Widget allows quick posting of new announcements', () => {
    it('should show create form when add button is clicked', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue([]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      const addButton = screen.getByRole('button', { name: /add|create|new/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/content/i)).toBeInTheDocument();
      });
    });

    it('should create announcement with title and content', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue([]);
      mockAnnouncementService.create.mockResolvedValue({
        id: 3,
        title: 'New Announcement',
        content: 'New announcement content'
      });

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      // Click add button to show form
      const addButton = screen.getByRole('button', { name: /add|create|new/i });
      await user.click(addButton);

      // Fill form
      const titleInput = screen.getByPlaceholderText(/title/i);
      const contentInput = screen.getByPlaceholderText(/content/i);
      
      await user.type(titleInput, 'New Announcement');
      await user.type(contentInput, 'New announcement content');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save|submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAnnouncementService.create).toHaveBeenCalledWith({
          title: 'New Announcement',
          content: 'New announcement content',
          expirationDate: null
        });
      });
    });

    it('should create announcement with optional expiration date', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue([]);
      mockAnnouncementService.create.mockResolvedValue({ id: 4 });

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      const addButton = screen.getByRole('button', { name: /add|create|new/i });
      await user.click(addButton);

      await user.type(screen.getByPlaceholderText(/title/i), 'Expiring Announcement');
      await user.type(screen.getByPlaceholderText(/content/i), 'This will expire');
      
      // Set expiration date
      const expirationInput = screen.getByDisplayValue('');
      if (expirationInput.type === 'date') {
        await user.type(expirationInput, '2024-12-31');
      }

      const submitButton = screen.getByRole('button', { name: /save|submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAnnouncementService.create).toHaveBeenCalled();
      });
    });

    it('should validate required fields before submission', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue([]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      const addButton = screen.getByRole('button', { name: /add|create|new/i });
      await user.click(addButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /save|submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title.*required/i)).toBeInTheDocument();
      });

      expect(mockAnnouncementService.create).not.toHaveBeenCalled();
    });

    it('should hide create form for non-admin users', async () => {
      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      expect(screen.queryByRole('button', { name: /add|create|new/i })).not.toBeInTheDocument();
    });
  });

  describe('TC-011: Mobile-responsive design', () => {
    it('should render properly on mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667
      });

      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      const widget = screen.getByTestId('card');
      expect(widget).toBeInTheDocument();
      expect(widget).toHaveStyle({ width: '100%' });
    });
  });

  describe('Error handling', () => {
    it('should display error message when fetching announcements fails', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to load announcements/i)).toBeInTheDocument();
      });
    });

    it('should display error message when creating announcement fails', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue([]);
      mockAnnouncementService.create.mockRejectedValue(new Error('Server error'));

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      const addButton = screen.getByRole('button', { name: /add|create|new/i });
      await user.click(addButton);

      await user.type(screen.getByPlaceholderText(/title/i), 'Test');
      await user.type(screen.getByPlaceholderText(/content/i), 'Test content');

      const submitButton = screen.getByRole('button', { name: /save|submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
      });
    });

    it('should show loading state during operations', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      
      // Mock slow loading
      mockAnnouncementService.getAll.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
    });
  });
});