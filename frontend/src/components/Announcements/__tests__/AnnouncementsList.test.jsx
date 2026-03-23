import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});