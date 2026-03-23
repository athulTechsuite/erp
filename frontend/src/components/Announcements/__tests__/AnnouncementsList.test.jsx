import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import AnnouncementsList from '../AnnouncementsList';
import { announcementsSlice } from '../../../store/slices/announcementsSlice';
import { authSlice } from '../../../store/slices/authSlice';
import * as announcementService from '../../../services/announcementService';

// Mock the announcement service
jest.mock('../../../services/announcementService');

// Mock Material-UI components that might cause issues in tests
jest.mock('@mui/material/Pagination', () => {
  return function MockPagination({ count, page, onChange }) {
    return (
      <div data-testid="pagination">
        <button 
          data-testid="prev-page" 
          onClick={() => onChange(null, page - 1)}
          disabled={page === 1}
        >
          Previous
        </button>
        <span data-testid="current-page">{page}</span>
        <button 
          data-testid="next-page" 
          onClick={() => onChange(null, page + 1)}
          disabled={page === count}
        >
          Next
        </button>
      </div>
    );
  };
});

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      announcements: announcementsSlice.reducer,
      auth: authSlice.reducer,
    },
    preloadedState: {
      announcements: {
        items: [],
        loading: false,
        error: null,
        pagination: {
          page: 1,
          totalPages: 1,
          totalItems: 0,
          limit: 10
        },
        ...initialState.announcements
      },
      auth: {
        user: {
          id: 1,
          email: 'user@company.com',
          role: 'employee'
        },
        isAuthenticated: true,
        ...initialState.auth
      }
    }
  });
};

const renderWithProviders = (component, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('AnnouncementsList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-001: Admin can create announcements
  describe('TC-001: Admin Create Announcements', () => {
    const adminState = {
      auth: {
        user: {
          id: 1,
          email: 'admin@company.com',
          role: 'admin'
        },
        isAuthenticated: true
      }
    };

    it('should allow admin to create new announcement - happy path', async () => {
      announcementService.createAnnouncement = jest.fn().mockResolvedValue({
        id: 1,
        title: 'New Announcement',
        content: 'Announcement content',
        priority: 'normal',
        publishedAt: null,
        scheduledFor: null
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const contentInput = screen.getByTestId('announcement-content-input');
      const submitButton = screen.getByTestId('submit-announcement');

      fireEvent.change(titleInput, { target: { value: 'New Announcement' } });
      fireEvent.change(contentInput, { target: { value: 'Announcement content' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(announcementService.createAnnouncement).toHaveBeenCalledWith({
          title: 'New Announcement',
          content: 'Announcement content',
          priority: 'normal'
        });
      });

      expect(screen.getByText('Announcement created successfully')).toBeInTheDocument();
    });

    it('should handle create announcement errors - error path', async () => {
      announcementService.createAnnouncement = jest.fn().mockRejectedValue(
        new Error('Failed to create announcement')
      );

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const submitButton = screen.getByTestId('submit-announcement');

      fireEvent.change(titleInput, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create announcement')).toBeInTheDocument();
      });
    });

    it('should validate required fields on create', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const submitButton = screen.getByTestId('submit-announcement');
      fireEvent.click(submitButton);

      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(screen.getByText('Content is required')).toBeInTheDocument();
    });
  });

  // TC-002: Admin can edit announcements
  describe('TC-002: Admin Edit Announcements', () => {
    const adminState = {
      auth: {
        user: {
          id: 1,
          email: 'admin@company.com',
          role: 'admin'
        },
        isAuthenticated: true
      },
      announcements: {
        items: [{
          id: 1,
          title: 'Original Title',
          content: 'Original content',
          priority: 'normal',
          publishedAt: '2024-01-15T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        }],
        loading: false
      }
    };

    it('should allow admin to edit existing announcement - happy path', async () => {
      announcementService.updateAnnouncement = jest.fn().mockResolvedValue({
        id: 1,
        title: 'Updated Title',
        content: 'Updated content',
        priority: 'important'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const editButton = screen.getByTestId('edit-announcement-1');
      fireEvent.click(editButton);

      const titleInput = screen.getByTestId('edit-title-input-1');
      const contentInput = screen.getByTestId('edit-content-input-1');
      const prioritySelect = screen.getByTestId('edit-priority-select-1');
      const saveButton = screen.getByTestId('save-announcement-1');

      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      fireEvent.change(contentInput, { target: { value: 'Updated content' } });
      fireEvent.change(prioritySelect, { target: { value: 'important' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(announcementService.updateAnnouncement).toHaveBeenCalledWith(1, {
          title: 'Updated Title',
          content: 'Updated content',
          priority: 'important'
        });
      });

      expect(screen.getByText('Announcement updated successfully')).toBeInTheDocument();
    });

    it('should handle edit announcement errors - error path', async () => {
      announcementService.updateAnnouncement = jest.fn().mockRejectedValue(
        new Error('Failed to update announcement')
      );

      renderWithProviders(<AnnouncementsList />, adminState);

      const editButton = screen.getByTestId('edit-announcement-1');
      fireEvent.click(editButton);

      const saveButton = screen.getByTestId('save-announcement-1');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to update announcement')).toBeInTheDocument();
      });
    });

    it('should cancel edit mode when cancel button is clicked', () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const editButton = screen.getByTestId('edit-announcement-1');
      fireEvent.click(editButton);

      expect(screen.getByTestId('edit-title-input-1')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('cancel-edit-1');
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('edit-title-input-1')).not.toBeInTheDocument();
    });
  });

  // TC-003: Admin can delete announcements
  describe('TC-003: Admin Delete Announcements', () => {
    const adminState = {
      auth: {
        user: {
          id: 1,
          email: 'admin@company.com',
          role: 'admin'
        },
        isAuthenticated: true
      },
      announcements: {
        items: [{
          id: 1,
          title: 'Announcement to Delete',
          content: 'Content to delete',
          priority: 'normal',
          publishedAt: '2024-01-15T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        }],
        loading: false
      }
    };

    it('should allow admin to delete announcement with confirmation - happy path', async () => {
      announcementService.deleteAnnouncement = jest.fn().mockResolvedValue({ success: true });

      renderWithProviders(<AnnouncementsList />, adminState);

      const deleteButton = screen.getByTestId('delete-announcement-1');
      fireEvent.click(deleteButton);

      // Confirm deletion in modal
      const confirmButton = screen.getByTestId('confirm-delete-announcement');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1);
      });

      expect(screen.getByText('Announcement deleted successfully')).toBeInTheDocument();
    });

    it('should handle delete announcement errors - error path', async () => {
      announcementService.deleteAnnouncement = jest.fn().mockRejectedValue(
        new Error('Failed to delete announcement')
      );

      renderWithProviders(<AnnouncementsList />, adminState);

      const deleteButton = screen.getByTestId('delete-announcement-1');
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByTestId('confirm-delete-announcement');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete announcement')).toBeInTheDocument();
      });
    });

    it('should cancel deletion when cancel button is clicked', () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const deleteButton = screen.getByTestId('delete-announcement-1');
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByTestId('cancel-delete-announcement');
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('confirm-delete-announcement')).not.toBeInTheDocument();
    });
  });

  // TC-004: Priority levels work correctly
  describe('TC-004: Priority Levels Functionality', () => {
    it('should display and sort announcements by priority correctly - happy path', () => {
      const priorityAnnouncements = [
        {
          id: 1,
          title: 'Normal Priority',
          content: 'Normal content',
          priority: 'normal',
          publishedAt: '2024-01-15T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        },
        {
          id: 2,
          title: 'Urgent Alert',
          content: 'Urgent content',
          priority: 'urgent',
          publishedAt: '2024-01-14T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        },
        {
          id: 3,
          title: 'Important Notice',
          content: 'Important content',
          priority: 'important',
          publishedAt: '2024-01-13T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        }
      ];

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: priorityAnnouncements,
          loading: false
        }
      });

      // Check priority chips are displayed with correct colors
      const urgentChip = screen.getByText('Urgent');
      const importantChip = screen.getByText('Important');
      const normalChip = screen.getByText('Normal');

      expect(urgentChip).toBeInTheDocument();
      expect(importantChip).toBeInTheDocument();
      expect(normalChip).toBeInTheDocument();

      // Check priority-specific styling
      expect(urgentChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
      expect(importantChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
      expect(normalChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorDefault');
    });

    it('should handle invalid priority values gracefully - error path', () => {
      const invalidPriorityAnnouncement = [{
        id: 1,
        title: 'Invalid Priority',
        content: 'Content with invalid priority',
        priority: 'invalid_priority',
        publishedAt: '2024-01-15T10:00:00Z',
        author: { name: 'Admin' },
        attachments: []
      }];

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: invalidPriorityAnnouncement,
          loading: false
        }
      });

      // Should default to normal priority display
      expect(screen.getByText('Normal')).toBeInTheDocument();
    });

    it('should filter announcements by priority level', async () => {
      renderWithProviders(<AnnouncementsList />);

      const priorityFilter = screen.getByTestId('priority-filter');
      fireEvent.change(priorityFilter, { target: { value: 'urgent' } });

      await waitFor(() => {
        expect(announcementService.getAnnouncements).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: 'urgent'
          })
        );
      });
    });
  });

  // TC-005: Scheduling functionality works
  describe('TC-005: Announcement Scheduling Functionality', () => {
    const adminState = {
      auth: {
        user: {
          id: 1,
          email: 'admin@company.com',
          role: 'admin'
        },
        isAuthenticated: true
      }
    };

    it('should allow admin to schedule announcements for future publication - happy path', async () => {
      announcementService.createAnnouncement = jest.fn().mockResolvedValue({
        id: 1,
        title: 'Scheduled Announcement',
        content: 'Future content',
        priority: 'normal',
        publishedAt: null,
        scheduledFor: '2024-02-15T10:00:00Z'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const contentInput = screen.getByTestId('announcement-content-input');
      const scheduleCheckbox = screen.getByTestId('schedule-announcement-checkbox');
      const scheduleDateInput = screen.getByTestId('schedule-date-input');
      const submitButton = screen.getByTestId('submit-announcement');

      fireEvent.change(titleInput, { target: { value: 'Scheduled Announcement' } });
      fireEvent.change(contentInput, { target: { value: 'Future content' } });
      fireEvent.click(scheduleCheckbox);
      fireEvent.change(scheduleDateInput, { target: { value: '2024-02-15T10:00' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(announcementService.createAnnouncement).toHaveBeenCalledWith({
          title: 'Scheduled Announcement',
          content: 'Future content',
          priority: 'normal',
          scheduledFor: '2024-02-15T10:00:00.000Z'
        });
      });

      expect(screen.getByText('Announcement scheduled successfully')).toBeInTheDocument();
    });

    it('should handle scheduling errors - error path', async () => {
      announcementService.createAnnouncement = jest.fn().mockRejectedValue(
        new Error('Failed to schedule announcement')
      );

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const scheduleCheckbox = screen.getByTestId('schedule-announcement-checkbox');
      const scheduleDateInput = screen.getByTestId('schedule-date-input');
      const submitButton = screen.getByTestId('submit-announcement');

      fireEvent.change(titleInput, { target: { value: 'Failed Schedule' } });
      fireEvent.click(scheduleCheckbox);
      fireEvent.change(scheduleDateInput, { target: { value: '2024-02-15T10:00' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to schedule announcement')).toBeInTheDocument();
      });
    });

    it('should validate scheduled date is in the future', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const scheduleCheckbox = screen.getByTestId('schedule-announcement-checkbox');
      const scheduleDateInput = screen.getByTestId('schedule-date-input');

      fireEvent.click(scheduleCheckbox);
      // Set date in the past
      fireEvent.change(scheduleDateInput, { target: { value: '2020-01-01T10:00' } });

      expect(screen.getByText('Scheduled date must be in the future')).toBeInTheDocument();
    });

    it('should display scheduled announcements with appropriate indicators', () => {
      const scheduledAnnouncement = [{
        id: 1,
        title: 'Future Announcement',
        content: 'Scheduled content',
        priority: 'normal',
        publishedAt: null,
        scheduledFor: '2024-02-15T10:00:00Z',
        author: { name: 'Admin' },
        attachments: []
      }];

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: scheduledAnnouncement,
          loading: false
        }
      });

      expect(screen.getByTestId('scheduled-indicator-1')).toBeInTheDocument();
      expect(screen.getByText('Scheduled for Feb 15, 2024 10:00 AM')).toBeInTheDocument();
    });
  });

  // TC-006: Employee view shows announcements (enhanced coverage)
  describe('TC-006: Employee View Shows Announcements', () => {
    const mockAnnouncements = [
      {
        id: 1,
        title: 'Latest Company Update',
        content: 'Important news about company policies',
        priority: 'important',
        publishedAt: '2024-01-15T10:00:00Z',
        isRead: false,
        author: {
          name: 'John Admin',
          avatar: '/avatars/john.jpg'
        },
        attachments: []
      },
      {
        id: 2,
        title: 'Office Renovation Notice', 
        content: 'The office will undergo renovation next month',
        priority: 'normal',
        publishedAt: '2024-01-10T09:00:00Z',
        isRead: true,
        author: {
          name: 'Jane Manager',
          avatar: '/avatars/jane.jpg'
        },
        attachments: []
      }
    ];

    it('should display announcements in chronological order (latest first) - happy path', () => {
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: mockAnnouncements,
          loading: false
        }
      });

      const announcementTitles = screen.getAllByTestId(/announcement-title/);
      expect(announcementTitles[0]).toHaveTextContent('Latest Company Update');
      expect(announcementTitles[1]).toHaveTextContent('Office Renovation Notice');
    });

    it('should show loading state while fetching announcements', () => {
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [],
          loading: true
        }
      });

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should display error message when fetch fails - error path', () => {
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [],
          loading: false,
          error: 'Failed to fetch announcements'
        }
      });

      expect(screen.getByText('Failed to fetch announcements')).toBeInTheDocument();
    });

    it('should display empty state when no announcements exist', () => {
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [],
          loading: false,
          error: null
        }
      });

      expect(screen.getByText('No announcements available')).toBeInTheDocument();
    });

    it('should handle network errors gracefully - error path', () => {
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [],
          loading: false,
          error: 'Network error occurred'
        }
      });

      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      expect(screen.getByTestId('retry-fetch-button')).toBeInTheDocument();
    });

    it('should refresh announcements when retry button is clicked', async () => {
      announcementService.getAnnouncements = jest.fn().mockResolvedValue({
        announcements: mockAnnouncements,
        pagination: { page: 1, totalPages: 1, totalItems: 2 }
      });

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [],
          loading: false,
          error: 'Network error occurred'
        }
      });

      const retryButton = screen.getByTestId('retry-fetch-button');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(announcementService.getAnnouncements).toHaveBeenCalled();
      });
    });
  });

  // TC-007: Employees can mark announcements as read/unread
  describe('TC-007: Mark Read/Unread Functionality', () => {
    const mockAnnouncement = {
      id: 1,
      title: 'Test Announcement',
      content: 'Test content',
      priority: 'normal',
      publishedAt: '2024-01-15T10:00:00Z',
      isRead: false,
      author: { name: 'Test Author' },
      attachments: []
    };

    it('should mark announcement as read when read button is clicked', async () => {
      announcementService.markAsRead = jest.fn().mockResolvedValue({ success: true });
      
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [mockAnnouncement],
          loading: false
        }
      });

      const readButton = screen.getByTestId('mark-read-button-1');
      fireEvent.click(readButton);

      await waitFor(() => {
        expect(announcementService.markAsRead).toHaveBeenCalledWith(1);
      });
    });

    it('should mark announcement as unread when unread button is clicked', async () => {
      const readAnnouncement = { ...mockAnnouncement, isRead: true };
      announcementService.markAsUnread = jest.fn().mockResolvedValue({ success: true });
      
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [readAnnouncement],
          loading: false
        }
      });

      const unreadButton = screen.getByTestId('mark-unread-button-1');
      fireEvent.click(unreadButton);

      await waitFor(() => {
        expect(announcementService.markAsUnread).toHaveBeenCalledWith(1);
      });
    });

    it('should show visual indicators for read vs unread announcements', () => {
      const announcements = [
        { ...mockAnnouncement, id: 1, isRead: false },
        { ...mockAnnouncement, id: 2, isRead: true }
      ];

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: announcements,
          loading: false
        }
      });

      // Check for unread indicator on first announcement
      expect(screen.getByTestId('unread-indicator-1')).toBeInTheDocument();
      
      // Check that second announcement doesn't have unread indicator
      expect(screen.queryByTestId('unread-indicator-2')).not.toBeInTheDocument();
    });
  });

  // TC-004: Display priority levels correctly
  describe('TC-004: Priority Level Display', () => {
    it('should display different priority levels with appropriate styling', () => {
      const priorityAnnouncements = [
        {
          id: 1,
          title: 'Urgent Alert',
          content: 'Urgent content',
          priority: 'urgent',
          publishedAt: '2024-01-15T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        },
        {
          id: 2,
          title: 'Important Notice',
          content: 'Important content',
          priority: 'important',
          publishedAt: '2024-01-14T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        },
        {
          id: 3,
          title: 'Regular Update',
          content: 'Normal content',
          priority: 'normal',
          publishedAt: '2024-01-13T10:00:00Z',
          author: { name: 'Admin' },
          attachments: []
        }
      ];

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: priorityAnnouncements,
          loading: false
        }
      });

      // Check priority chips are displayed
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Important')).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();

      // Check priority-specific styling
      const urgentChip = screen.getByText('Urgent').closest('.MuiChip-root');
      expect(urgentChip).toHaveClass('MuiChip-colorError');
    });
  });

  // TC-009: File attachments display
  describe('TC-009: File Attachments Display', () => {
    it('should display attachment indicators when announcements have files', () => {
      const announcementWithAttachment = {
        id: 1,
        title: 'Announcement with Files',
        content: 'Content with attachments',
        priority: 'normal',
        publishedAt: '2024-01-15T10:00:00Z',
        author: { name: 'Admin' },
        attachments: [
          {
            id: 1,
            filename: 'document.pdf',
            originalName: 'Important Document.pdf',
            size: 1024000,
            url: '/uploads/document.pdf'
          }
        ]
      };

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [announcementWithAttachment],
          loading: false
        }
      });

      expect(screen.getByTestId('attachment-indicator-1')).toBeInTheDocument();
      expect(screen.getByText('1 attachment')).toBeInTheDocument();
    });

    it('should handle multiple attachments correctly', () => {
      const announcementWithMultipleAttachments = {
        id: 1,
        title: 'Multiple Files',
        content: 'Content with multiple attachments',
        priority: 'normal',
        publishedAt: '2024-01-15T10:00:00Z',
        author: { name: 'Admin' },
        attachments: [
          { id: 1, filename: 'doc1.pdf' },
          { id: 2, filename: 'doc2.pdf' },
          { id: 3, filename: 'image.jpg' }
        ]
      };

      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [announcementWithMultipleAttachments],
          loading: false
        }
      });

      expect(screen.getByText('3 attachments')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search Functionality', () => {
    it('should filter announcements by priority', async () => {
      renderWithProviders(<AnnouncementsList />);

      const priorityFilter = screen.getByTestId('priority-filter');
      fireEvent.change(priorityFilter, { target: { value: 'urgent' } });

      await waitFor(() => {
        expect(announcementService.getAnnouncements).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: 'urgent'
          })
        );
      });
    });

    it('should search announcements by title/content', async () => {
      renderWithProviders(<AnnouncementsList />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'company update' } });

      await waitFor(() => {
        expect(announcementService.getAnnouncements).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'company update'
          })
        );
      }, { timeout: 1000 }); // Debounced search
    });

    it('should filter by read/unread status', async () => {
      renderWithProviders(<AnnouncementsList />);

      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { value: 'unread' } });

      await waitFor(() => {
        expect(announcementService.getAnnouncements).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'unread'
          })
        );
      });
    });
  });

  describe('Pagination', () => {
    it('should handle page navigation correctly', async () => {
      renderWithProviders(<AnnouncementsList />, {
        announcements: {
          items: [],
          loading: false,
          pagination: {
            page: 1,
            totalPages: 3,
            totalItems: 25,
            limit: 10
          }
        }
      });

      const nextButton = screen.getByTestId('next-page');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(announcementService.getAnnouncements).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2
          })
        );
      });
    });
  });

  describe('Admin-specific functionality', () => {
    it('should show admin actions for admin users', () => {
      renderWithProviders(<AnnouncementsList />, {
        auth: {
          user: {
            id: 1,
            email: 'admin@company.com',
            role: 'admin'
          },
          isAuthenticated: true
        },
        announcements: {
          items: [{
            id: 1,
            title: 'Admin Announcement',
            content: 'Admin content',
            priority: 'normal',
            publishedAt: '2024-01-15T10:00:00Z',
            author: { name: 'Admin' },
            attachments: []
          }],
          loading: false
        }
      });

      expect(screen.getByTestId('edit-announcement-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-announcement-1')).toBeInTheDocument();
      expect(screen.getByTestId('view-stats-1')).toBeInTheDocument();
    });

    it('should hide admin actions for regular employees', () => {
      renderWithProviders(<AnnouncementsList />, {
        auth: {
          user: {
            id: 1,
            email: 'employee@company.com',
            role: 'employee'
          },
          isAuthenticated: true
        },
        announcements: {
          items: [{
            id: 1,
            title: 'Employee View',
            content: 'Employee content',
            priority: 'normal',
            publishedAt: '2024-01-15T10:00:00Z',
            author: { name: 'Admin' },
            attachments: []
          }],
          loading: false
        }
      });

      expect(screen.queryByTestId('edit-announcement-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-announcement-1')).not.toBeInTheDocument();
    });
  });

  // Enhanced Form Validation Test Coverage
  describe('Form Validation Scenarios', () => {
    const adminState = {
      auth: {
        user: {
          id: 1,
          email: 'admin@company.com',
          role: 'admin'
        },
        isAuthenticated: true
      }
    };

    it('should validate title length requirements', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const submitButton = screen.getByTestId('submit-announcement');

      // Test empty title
      fireEvent.click(submitButton);
      expect(screen.getByText('Title is required')).toBeInTheDocument();

      // Test title too short
      fireEvent.change(titleInput, { target: { value: 'a' } });
      fireEvent.blur(titleInput);
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();

      // Test title too long
      fireEvent.change(titleInput, { target: { value: 'a'.repeat(256) } });
      fireEvent.blur(titleInput);
      expect(screen.getByText('Title must be less than 255 characters')).toBeInTheDocument();

      // Test valid title
      fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
      fireEvent.blur(titleInput);
      expect(screen.queryByText('Title must be at least 3 characters')).not.toBeInTheDocument();
    });

    it('should validate content length requirements', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const contentInput = screen.getByTestId('announcement-content-input');
      const submitButton = screen.getByTestId('submit-announcement');

      // Test empty content
      fireEvent.click(submitButton);
      expect(screen.getByText('Content is required')).toBeInTheDocument();

      // Test content too short
      fireEvent.change(contentInput, { target: { value: 'ab' } });
      fireEvent.blur(contentInput);
      expect(screen.getByText('Content must be at least 10 characters')).toBeInTheDocument();

      // Test content too long
      fireEvent.change(contentInput, { target: { value: 'a'.repeat(5001) } });
      fireEvent.blur(contentInput);
      expect(screen.getByText('Content must be less than 5000 characters')).toBeInTheDocument();

      // Test valid content
      fireEvent.change(contentInput, { target: { value: 'This is valid content for the announcement' } });
      fireEvent.blur(contentInput);
      expect(screen.queryByText('Content must be at least 10 characters')).not.toBeInTheDocument();
    });

    it('should validate priority selection', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const prioritySelect = screen.getByTestId('announcement-priority-select');
      
      // Test invalid priority
      fireEvent.change(prioritySelect, { target: { value: 'invalid' } });
      fireEvent.blur(prioritySelect);
      expect(screen.getByText('Please select a valid priority')).toBeInTheDocument();

      // Test valid priority
      fireEvent.change(prioritySelect, { target: { value: 'urgent' } });
      fireEvent.blur(prioritySelect);
      expect(screen.queryByText('Please select a valid priority')).not.toBeInTheDocument();
    });

    it('should validate scheduled date when scheduling is enabled', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const scheduleCheckbox = screen.getByTestId('schedule-announcement-checkbox');
      const scheduleDateInput = screen.getByTestId('schedule-date-input');

      fireEvent.click(scheduleCheckbox);

      // Test empty date when scheduling is enabled
      fireEvent.blur(scheduleDateInput);
      expect(screen.getByText('Scheduled date is required when scheduling is enabled')).toBeInTheDocument();

      // Test past date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      fireEvent.change(scheduleDateInput, { 
        target: { value: pastDate.toISOString().slice(0, 16) } 
      });
      fireEvent.blur(scheduleDateInput);
      expect(screen.getByText('Scheduled date must be in the future')).toBeInTheDocument();

      // Test valid future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      fireEvent.change(scheduleDateInput, { 
        target: { value: futureDate.toISOString().slice(0, 16) } 
      });
      fireEvent.blur(scheduleDateInput);
      expect(screen.queryByText('Scheduled date must be in the future')).not.toBeInTheDocument();
    });

    it('should validate form prevents submission with multiple errors', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const contentInput = screen.getByTestId('announcement-content-input');
      const scheduleCheckbox = screen.getByTestId('schedule-announcement-checkbox');
      const submitButton = screen.getByTestId('submit-announcement');

      // Create multiple validation errors
      fireEvent.change(titleInput, { target: { value: 'a' } }); // Too short
      fireEvent.change(contentInput, { target: { value: 'ab' } }); // Too short
      fireEvent.click(scheduleCheckbox); // Enable scheduling without date
      
      fireEvent.click(submitButton);

      // Check all errors are displayed
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
      expect(screen.getByText('Content must be at least 10 characters')).toBeInTheDocument();
      expect(screen.getByText('Scheduled date is required when scheduling is enabled')).toBeInTheDocument();

      // Verify form was not submitted
      expect(announcementService.createAnnouncement).not.toHaveBeenCalled();
    });

    it('should show real-time character count for title and content', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const contentInput = screen.getByTestId('announcement-content-input');

      fireEvent.change(titleInput, { target: { value: 'Test Title' } });
      fireEvent.change(contentInput, { target: { value: 'Test content for the announcement' } });

      expect(screen.getByText('10/255 characters')).toBeInTheDocument(); // Title counter
      expect(screen.getByText('34/5000 characters')).toBeInTheDocument(); // Content counter
    });

    it('should validate HTML content sanitization', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const contentInput = screen.getByTestId('announcement-content-input');
      
      // Test script injection attempt
      fireEvent.change(contentInput, { 
        target: { value: '<script>alert("xss")</script>Valid content here' } 
      });
      fireEvent.blur(contentInput);

      expect(screen.getByText('Content contains invalid HTML tags')).toBeInTheDocument();
    });

    it('should handle form reset after successful submission', async () => {
      announcementService.createAnnouncement = jest.fn().mockResolvedValue({
        id: 1,
        title: 'New Announcement',
        content: 'New content',
        priority: 'normal'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const titleInput = screen.getByTestId('announcement-title-input');
      const contentInput = screen.getByTestId('announcement-content-input');
      const submitButton = screen.getByTestId('submit-announcement');

      fireEvent.change(titleInput, { target: { value: 'New Announcement' } });
      fireEvent.change(contentInput, { target: { value: 'This is the announcement content' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(titleInput.value).toBe('');
        expect(contentInput.value).toBe('');
      });
    });
  });

  // File Upload Test Coverage
  describe('File Upload Functionality', () => {
    const adminState = {
      auth: {
        user: {
          id: 1,
          email: 'admin@company.com',
          role: 'admin'
        },
        isAuthenticated: true
      }
    };

    const user = userEvent.setup();

    it('should handle single file upload successfully', async () => {
      announcementService.uploadAttachment = jest.fn().mockResolvedValue({
        id: 1,
        filename: 'document.pdf',
        originalName: 'Document.pdf',
        size: 1024000,
        url: '/uploads/document.pdf'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      const file = new File(['file content'], 'document.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(announcementService.uploadAttachment).toHaveBeenCalledWith(file);
      });

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    });

    it('should handle multiple file uploads', async () => {
      announcementService.uploadAttachment = jest.fn()
        .mockResolvedValueOnce({
          id: 1,
          filename: 'document1.pdf',
          originalName: 'Document1.pdf',
          size: 1024000,
          url: '/uploads/document1.pdf'
        })
        .mockResolvedValueOnce({
          id: 2,
          filename: 'document2.pdf',
          originalName: 'Document2.pdf',
          size: 2048000,
          url: '/uploads/document2.pdf'
        });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      const files = [
        new File(['content1'], 'document1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'document2.pdf', { type: 'application/pdf' })
      ];

      await user.upload(fileInput, files);

      await waitFor(() => {
        expect(announcementService.uploadAttachment).toHaveBeenCalledTimes(2);
      });

      expect(screen.getByText('document1.pdf')).toBeInTheDocument();
      expect(screen.getByText('document2.pdf')).toBeInTheDocument();
    });

    it('should validate file size limits', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      
      // Create a file larger than allowed (e.g., 10MB limit)
      const largeFile = new File(
        [new ArrayBuffer(11 * 1024 * 1024)], 
        'large-document.pdf', 
        { type: 'application/pdf' }
      );

      await user.upload(fileInput, largeFile);

      expect(screen.getByText('File size exceeds 10MB limit')).toBeInTheDocument();
    });

    it('should validate file types', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      
      // Create an executable file (not allowed)
      const invalidFile = new File(['content'], 'virus.exe', { type: 'application/x-executable' });

      await user.upload(fileInput, invalidFile);

      expect(screen.getByText('File type not allowed. Allowed types: PDF, DOC, DOCX, JPG, PNG')).toBeInTheDocument();
    });

    it('should handle file upload errors', async () => {
      announcementService.uploadAttachment = jest.fn().mockRejectedValue(
        new Error('Upload failed')
      );

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Failed to upload file: document.pdf')).toBeInTheDocument();
      });
    });

    it('should show upload progress for large files', async () => {
      // Mock XMLHttpRequest for progress tracking
      const mockXHR = {
        upload: {
          addEventListener: jest.fn()
        },
        open: jest.fn(),
        send: jest.fn(),
        setRequestHeader: jest.fn()
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR);

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      const file = new File([new ArrayBuffer(5 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, file);

      // Simulate progress event
      const progressCallback = mockXHR.upload.addEventListener.mock.calls.find(
        call => call[0] === 'progress'
      )[1];

      progressCallback({ loaded: 2.5 * 1024 * 1024, total: 5 * 1024 * 1024 });

      expect(screen.getByTestId('upload-progress-large.pdf')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should allow removing uploaded files before submission', async () => {
      announcementService.uploadAttachment = jest.fn().mockResolvedValue({
        id: 1,
        filename: 'document.pdf',
        originalName: 'Document.pdf',
        size: 1024000,
        url: '/uploads/document.pdf'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId('remove-file-1');
      fireEvent.click(removeButton);

      expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
    });

    it('should handle drag and drop file upload', async () => {
      announcementService.uploadAttachment = jest.fn().mockResolvedValue({
        id: 1,
        filename: 'dropped.pdf',
        originalName: 'Dropped.pdf',
        size: 1024000,
        url: '/uploads/dropped.pdf'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });

      // Simulate drag and drop
      fireEvent.dragEnter(dropZone);
      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });

      await waitFor(() => {
        expect(announcementService.uploadAttachment).toHaveBeenCalledWith(file);
      });

      expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
    });

    it('should validate maximum number of attachments', async () => {
      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      
      // Create more files than allowed (assuming 5 is the limit)
      const files = Array.from({ length: 6 }, (_, i) => 
        new File(['content'], `document${i}.pdf`, { type: 'application/pdf' })
      );

      await user.upload(fileInput, files);

      expect(screen.getByText('Maximum 5 files allowed per announcement')).toBeInTheDocument();
    });

    it('should show file preview for images', async () => {
      announcementService.uploadAttachment = jest.fn().mockResolvedValue({
        id: 1,
        filename: 'image.jpg',
        originalName: 'Image.jpg',
        size: 512000,
        url: '/uploads/image.jpg',
        type: 'image/jpeg'
      });

      renderWithProviders(<AnnouncementsList />, adminState);

      const createButton = screen.getByTestId('create-announcement-button');
      fireEvent.click(createButton);

      const fileInput = screen.getByTestId('file-upload-input');
      const imageFile = new File(['image content'], 'image.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, imageFile);

      await waitFor(() => {
        expect(screen.getByTestId('image-preview-1')).toBeInTheDocument();
      });

      const previewImage = screen.getByAltText('Preview of image.jpg');
      expect(previewImage.src).toBe('http://localhost/uploads/image.jpg');
    });

    it('should handle file attachment in edit mode', async () => {
      const adminStateWithAnnouncement = {
        ...adminState,
        announcements: {
          items: [{
            id: 1,
            title: 'Existing Announcement',
            content: 'Existing content',
            priority: 'normal',
            publishedAt: '2024-01-15T10:00:00Z',
            author: { name: 'Admin' },
            attachments: [{
              id: 1,
              filename: 'existing.pdf',
              originalName: 'Existing.pdf',
              size: 1024000,
              url: '/uploads/existing.pdf'
            }]
          }],
          loading: false
        }
      };

      announcementService.uploadAttachment = jest.fn().mockResolvedValue({
        id: 2,
        filename: 'new.pdf',
        originalName: 'New.pdf',
        size: 512000,
        url: '/uploads/new.pdf'
      });

      renderWithProviders(<AnnouncementsList />, adminStateWithAnnouncement);

      const editButton = screen.getByTestId('edit-announcement-1');
      fireEvent.click(editButton);

      // Existing attachment should be shown
      expect(screen.getByText('existing.pdf')).toBeInTheDocument();

      // Add new attachment
      const fileInput = screen.getByTestId('edit-file-upload-input-1');
      const newFile = new File(['content'], 'new.pdf', { type: 'application/pdf' });

      await user.upload(fileInput, newFile);

      await waitFor(() => {
        expect(screen.getByText('new.pdf')).toBeInTheDocument();
      });

      // Both files should be present
      expect(screen.getByText('existing.pdf')).toBeInTheDocument();
      expect(screen.getByText('new.pdf')).toBeInTheDocument();
    });

    it('should handle attachment deletion from existing announcements', async () => {
      const adminStateWithAnnouncement = {
        ...adminState,
        announcements: {
          items: [{
            id: 1,
            title: 'Announcement with Attachment',
            content: 'Content with attachment',
            priority: 'normal',
            publishedAt: '2024-01-15T10:00:00Z',
            author: { name: 'Admin' },
            attachments: [{
              id: 1,
              filename: 'to-delete.pdf',
              originalName: 'ToDelete.pdf',
              size: 1024000,
              url: '/uploads/to-delete.pdf'
            }]
          }],
          loading: false
        }
      };

      announcementService.deleteAttachment = jest.fn().mockResolvedValue({ success: true });

      renderWithProviders(<AnnouncementsList />, adminStateWithAnnouncement);

      const editButton = screen.getByTestId('edit-announcement-1');
      fireEvent.click(editButton);

      const deleteAttachmentButton = screen.getByTestId('delete-attachment-1');
      fireEvent.click(deleteAttachmentButton);

      // Confirm deletion
      const confirmDeleteButton = screen.getByTestId('confirm-delete-attachment');
      fireEvent.click(confirmDeleteButton);

      await waitFor(() => {
        expect(announcementService.deleteAttachment).toHaveBeenCalledWith(1);
      });

      expect(screen.queryByText('to-delete.pdf')).not.toBeInTheDocument();
    });
  });
});