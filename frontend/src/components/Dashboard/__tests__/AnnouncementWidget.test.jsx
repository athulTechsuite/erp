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

  // TC-001: Admin creates announcement with title, content, expiration date
  describe('TC-001: Admin creates announcement with title, content, expiration date', () => {
    it('should successfully create announcement with all fields (happy path)', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue([]);
      mockAnnouncementService.create.mockResolvedValue({
        id: 3,
        title: 'New Announcement',
        content: 'New announcement content',
        expirationDate: '2024-12-31T00:00:00Z'
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

      // Fill form with all fields
      const titleInput = screen.getByPlaceholderText(/title/i);
      const contentInput = screen.getByPlaceholderText(/content/i);
      const expirationInput = screen.getByDisplayValue('');
      
      await user.type(titleInput, 'New Announcement');
      await user.type(contentInput, 'New announcement content');
      if (expirationInput.type === 'date') {
        await user.type(expirationInput, '2024-12-31');
      }

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save|submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAnnouncementService.create).toHaveBeenCalledWith({
          title: 'New Announcement',
          content: 'New announcement content',
          expirationDate: '2024-12-31'
        });
      });
    });

    it('should handle validation errors when creating announcement (error path)', async () => {
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

    it('should handle server error when creating announcement (error path)', async () => {
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
        expect(screen.getByText(/failed to create/i)).toBeInTheDocument();
      });
    });
  });

  // TC-002: Admin edits existing announcement
  describe('TC-002: Admin edits existing announcement', () => {
    it('should successfully edit existing announcement (happy path)', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);
      mockAnnouncementService.update.mockResolvedValue({
        ...mockAnnouncements[0],
        title: 'Updated Title',
        content: 'Updated content'
      });

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });

      // Click edit button on first announcement
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Form should be populated with existing data
      const titleInput = screen.getByDisplayValue('Company Update');
      const contentInput = screen.getByDisplayValue('Important company news here');

      // Modify the fields
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');
      await user.clear(contentInput);
      await user.type(contentInput, 'Updated content');

      // Submit changes
      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockAnnouncementService.update).toHaveBeenCalledWith(1, {
          title: 'Updated Title',
          content: 'Updated content',
          expirationDate: null
        });
      });
    });

    it('should handle validation errors when editing announcement (error path)', async () => {
      const user = userEvent.setup();
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
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Clear required field
      const titleInput = screen.getByDisplayValue('Company Update');
      await user.clear(titleInput);

      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/title.*required/i)).toBeInTheDocument();
      });

      expect(mockAnnouncementService.update).not.toHaveBeenCalled();
    });

    it('should handle server error when editing announcement (error path)', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);
      mockAnnouncementService.update.mockRejectedValue(new Error('Update failed'));

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const titleInput = screen.getByDisplayValue('Company Update');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to update/i)).toBeInTheDocument();
      });
    });
  });

  // TC-003: Admin deletes announcement
  describe('TC-003: Admin deletes announcement', () => {
    it('should successfully delete announcement with confirmation (happy path)', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);
      mockAnnouncementService.delete.mockResolvedValue();

      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this announcement?');
        expect(mockAnnouncementService.delete).toHaveBeenCalledWith(1);
      });
    });

    it('should cancel deletion when user cancels confirmation (error path)', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);

      // Mock window.confirm to return false (cancel)
      window.confirm = jest.fn(() => false);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockAnnouncementService.delete).not.toHaveBeenCalled();
      });
    });

    it('should handle server error when deleting announcement (error path)', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);
      mockAnnouncementService.delete.mockRejectedValue(new Error('Delete failed'));

      window.confirm = jest.fn(() => true);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
      });
    });
  });

  // TC-004: System auto-archives expired announcements
  describe('TC-004: System auto-archives expired announcements', () => {
    it('should not display expired announcements (happy path)', async () => {
      const expiredAnnouncement = {
        id: 3,
        title: 'Expired Announcement',
        content: 'This should not be visible',
        createdAt: '2024-01-10T10:00:00Z',
        expirationDate: '2024-01-11T00:00:00Z', // Expired yesterday
        createdBy: { firstName: 'Admin', lastName: 'User' }
      };

      const currentAnnouncement = {
        id: 4,
        title: 'Current Announcement',
        content: 'This should be visible',
        createdAt: '2024-01-15T10:00:00Z',
        expirationDate: '2024-12-31T00:00:00Z', // Future date
        createdBy: { firstName: 'Admin', lastName: 'User' }
      };

      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
      mockAnnouncementService.getAll.mockResolvedValue([expiredAnnouncement, currentAnnouncement]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Current Announcement')).toBeInTheDocument();
        expect(screen.queryByText('Expired Announcement')).not.toBeInTheDocument();
      });
    });

    it('should handle system errors when filtering expired announcements (error path)', async () => {
      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
      mockAnnouncementService.getAll.mockRejectedValue(new Error('Database connection failed'));

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

    it('should handle announcements with malformed expiration dates (error path)', async () => {
      const malformedAnnouncement = {
        id: 5,
        title: 'Malformed Date Announcement',
        content: 'Has invalid date',
        createdAt: '2024-01-15T10:00:00Z',
        expirationDate: 'invalid-date',
        createdBy: { firstName: 'Admin', lastName: 'User' }
      };

      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
      mockAnnouncementService.getAll.mockResolvedValue([malformedAnnouncement]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      // Component should handle malformed dates gracefully
      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });
    });
  });

  // TC-007: Employees can view current announcements
  describe('TC-007: Employees can view current announcements', () => {
    it('should display current announcements for employee users (happy path)', async () => {
      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
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
        expect(screen.getByText('Important company news here')).toBeInTheDocument();
      });
    });

    it('should hide admin controls for employee users (happy path)', async () => {
      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
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
      });

      // Employee should not see admin controls
      expect(screen.queryByRole('button', { name: /add|create|new/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should handle authentication errors for employee access (error path)', async () => {
      mockUseAuth.mockReturnValue({ user: null }); // Not authenticated
      mockAnnouncementService.getAll.mockRejectedValue(new Error('Unauthorized'));

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/please log in/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors when loading announcements (error path)', async () => {
      mockUseAuth.mockReturnValue({ user: mockEmployeeUser });
      mockAnnouncementService.getAll.mockRejectedValue(new Error('Network timeout'));

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
  });

  // TC-008: Mobile responsive design works correctly
  describe('TC-008: Mobile responsive design works correctly', () => {
    beforeEach(() => {
      // Reset viewport after each test
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
    });

    it('should render properly on mobile viewport (happy path)', async () => {
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
      
      // Check that content is accessible
      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
        expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
      });
    });

    it('should render properly on tablet viewport (happy path)', async () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
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

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });
    });

    it('should handle touch interactions on mobile (happy path)', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

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

      // Test touch interaction with add button
      const addButton = screen.getByRole('button', { name: /add|create|new/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
      });
    });

    it('should handle viewport resize errors gracefully (error path)', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      mockAnnouncementService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementWidget />
          </TestWrapper>
        );
      });

      // Simulate extreme viewport change
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 100
      });

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });
    });

    it('should handle missing responsive breakpoints (error path)', async () => {
      // Mock undefined viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: undefined
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

      // Component should render with fallback styling
      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });
    });
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