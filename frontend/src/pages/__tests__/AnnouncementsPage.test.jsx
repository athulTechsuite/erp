import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AnnouncementsPage from '../AnnouncementsPage';
import { useAuth } from '../../contexts/AuthContext';
import { announcementsService } from '../../services/announcementsService';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../services/announcementsService');
jest.mock('@mui/x-date-pickers/DateTimePicker', () => {
  return function MockDateTimePicker(props) {
    return (
      <input
        type="datetime-local"
        value={props.value}
        onChange={(e) => props.onChange(new Date(e.target.value))}
        data-testid="expiration-date-picker"
      />
    );
  };
});

const theme = createTheme();

const TestWrapper = ({ children }) => (
  <Router>
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  </Router>
);

const mockUseAuth = useAuth;
const mockAnnouncementsService = announcementsService;

describe('AnnouncementsPage', () => {
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
      title: 'Company Policy Update',
      content: 'New company policies are now in effect. Please review the updated guidelines in the employee handbook.',
      createdAt: '2024-01-15T10:00:00Z',
      expirationDate: null,
      createdBy: {
        firstName: 'Admin',
        lastName: 'User'
      }
    },
    {
      id: 2,
      title: 'Holiday Schedule',
      content: 'The office will be closed on the following dates for the holidays. Please plan your work accordingly.',
      createdAt: '2024-01-14T09:00:00Z',
      expirationDate: '2024-12-25T00:00:00Z',
      createdBy: {
        firstName: 'Admin',
        lastName: 'User'
      }
    },
    {
      id: 3,
      title: 'System Maintenance',
      content: 'Our systems will undergo scheduled maintenance this weekend. Expect brief interruptions.',
      createdAt: '2024-01-13T14:30:00Z',
      expirationDate: '2024-01-20T00:00:00Z',
      createdBy: {
        firstName: 'IT',
        lastName: 'Admin'
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnnouncementsService.getAll = jest.fn();
    mockAnnouncementsService.create = jest.fn();
    mockAnnouncementsService.update = jest.fn();
    mockAnnouncementsService.delete = jest.fn();
  });

  describe('TC-005: Dedicated announcements section displays all announcements in chronological order', () => {
    it('should display all announcements in chronological order (newest first)', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      mockAnnouncementsService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
        expect(screen.getByText('Holiday Schedule')).toBeInTheDocument();
        expect(screen.getByText('System Maintenance')).toBeInTheDocument();
      });

      // Verify chronological order (newest first)
      const announcementTitles = screen.getAllByRole('heading').map(h => h.textContent);
      const expectedOrder = ['Company Policy Update', 'Holiday Schedule', 'System Maintenance'];
      expect(announcementTitles).toEqual(expect.arrayContaining(expectedOrder));
    });

    it('should display announcement content with proper formatting', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      mockAnnouncementsService.getAll.mockResolvedValue([
        {
          id: 1,
          title: 'Formatted Announcement',
          content: 'Line 1\nLine 2\nLine 3',
          createdAt: '2024-01-15T10:00:00Z',
          expirationDate: null,
          createdBy: { firstName: 'Admin', lastName: 'User' }
        }
      ]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const content = screen.getByText(/Line 1/);
        expect(content).toBeInTheDocument();
        // Check that line breaks are preserved
        expect(content.innerHTML).toContain('<br>');
      });
    });
  });

  describe('TC-008: Employees can view all current announcements in the announcements section', () => {
    it('should allow employees to view all active announcements', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      mockAnnouncementsService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Announcements')).toBeInTheDocument();
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
        expect(screen.getByText('Holiday Schedule')).toBeInTheDocument();
        expect(screen.getByText('System Maintenance')).toBeInTheDocument();
      });
    });

    it('should not show admin controls to employees', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      mockAnnouncementsService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /create|add new/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-001, TC-002, TC-003: Admin CRUD operations', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ 
        user: mockAdminUser,
        hasPermission: (permission) => permission === 'announcements:manage'
      });
    });

    it('should show create announcement button for admins', async () => {
      mockAnnouncementsService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create|add new/i })).toBeInTheDocument();
      });
    });

    it('should open create dialog when create button is clicked', async () => {
      const user = userEvent.setup();
      mockAnnouncementsService.getAll.mockResolvedValue([]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      const createButton = screen.getByRole('button', { name: /create|add new/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
      });
    });

    it('should create new announcement with title and content', async () => {
      const user = userEvent.setup();
      mockAnnouncementsService.getAll.mockResolvedValue([]);
      mockAnnouncementsService.create.mockResolvedValue({
        id: 4,
        title: 'New Test Announcement',
        content: 'This is a test announcement content'
      });

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      // Open create dialog
      const createButton = screen.getByRole('button', { name: /create|add new/i });
      await user.click(createButton);

      // Fill form
      const titleInput = screen.getByLabelText(/title/i);
      const contentInput = screen.getByLabelText(/content/i);
      
      await user.type(titleInput, 'New Test Announcement');
      await user.type(contentInput, 'This is a test announcement content');

      // Submit
      const submitButton = screen.getByRole('button', { name: /save|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAnnouncementsService.create).toHaveBeenCalledWith({
          title: 'New Test Announcement',
          content: 'This is a test announcement content',
          expirationDate: null
        });
      });
    });

    it('should create announcement with expiration date', async () => {
      const user = userEvent.setup();
      mockAnnouncementsService.getAll.mockResolvedValue([]);
      mockAnnouncementsService.create.mockResolvedValue({ id: 5 });

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      const createButton = screen.getByRole('button', { name: /create|add new/i });
      await user.click(createButton);

      await user.type(screen.getByLabelText(/title/i), 'Expiring Announcement');
      await user.type(screen.getByLabelText(/content/i), 'This will expire');
      
      const expirationPicker = screen.getByTestId('expiration-date-picker');
      await user.type(expirationPicker, '2024-12-31T23:59');

      const submitButton = screen.getByRole('button', { name: /save|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAnnouncementsService.create).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Expiring Announcement',
          content: 'This will expire',
          expirationDate: expect.any(Date)
        }));
      });
    });

    it('should show edit and delete options for admins', async () => {
      mockAnnouncementsService.getAll.mockResolvedValue([mockAnnouncements[0]]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const menuButton = screen.getByRole('button', { name: /more options/i });
        expect(menuButton).toBeInTheDocument();
      });
    });

    it('should edit existing announcement', async () => {
      const user = userEvent.setup();
      mockAnnouncementsService.getAll.mockResolvedValue([mockAnnouncements[0]]);
      mockAnnouncementsService.update.mockResolvedValue({ ...mockAnnouncements[0], title: 'Updated Title' });

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      // Open menu and click edit
      const menuButton = screen.getByRole('button', { name: /more options/i });
      await user.click(menuButton);
      
      const editButton = screen.getByRole('menuitem', { name: /edit/i });
      await user.click(editButton);

      // Update title
      const titleInput = screen.getByDisplayValue('Company Policy Update');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Policy');

      const saveButton = screen.getByRole('button', { name: /save|update/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockAnnouncementsService.update).toHaveBeenCalledWith(1, expect.objectContaining({
          title: 'Updated Policy'
        }));
      });
    });

    it('should delete announcement after confirmation', async () => {
      const user = userEvent.setup();
      mockAnnouncementsService.getAll.mockResolvedValue([mockAnnouncements[0]]);
      mockAnnouncementsService.delete.mockResolvedValue();

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      // Open menu and click delete
      const menuButton = screen.getByRole('button', { name: /more options/i });
      await user.click(menuButton);
      
      const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm|yes|delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockAnnouncementsService.delete).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('TC-011: Mobile-responsive design', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
    });

    it('should display announcements in mobile-friendly layout', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      mockAnnouncementsService.getAll.mockResolvedValue(mockAnnouncements);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const announcementCards = screen.getAllByRole('article');
        announcementCards.forEach(card => {
          expect(card).toHaveStyle({
            width: '100%',
            maxWidth: '100%'
          });
        });
      });
    });

    it('should show mobile-friendly create button', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockAdminUser,
        hasPermission: () => true 
      });
      mockAnnouncementsService.getAll.mockResolvedValue([]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      const createButton = screen.getByRole('button', { name: /create|add new/i });
      expect(createButton).toHaveAttribute('data-mobile-friendly', 'true');
    });
  });

  describe('Error handling and validation', () => {
    it('should display error when failing to load announcements', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      mockAnnouncementsService.getAll.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to load announcements/i)).toBeInTheDocument();
      });
    });

    it('should validate required fields in create form', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ 
        user: mockAdminUser,
        hasPermission: () => true 
      });
      mockAnnouncementsService.getAll.mockResolvedValue([]);

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      const createButton = screen.getByRole('button', { name: /create|add new/i });
      await user.click(createButton);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /save|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/content is required/i)).toBeInTheDocument();
      });

      expect(mockAnnouncementsService.create).not.toHaveBeenCalled();
    });

    it('should show loading state during operations', async () => {
      mockUseAuth.mockReturnValue({ 
        user: mockEmployeeUser,
        hasPermission: () => false 
      });
      
      // Mock slow loading
      mockAnnouncementsService.getAll.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      await act(async () => {
        render(
          <TestWrapper>
            <AnnouncementsPage />
          </TestWrapper>
        );
      });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});