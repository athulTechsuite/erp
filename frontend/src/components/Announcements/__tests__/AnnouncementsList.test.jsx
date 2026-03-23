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

  // TC-006: Employees can view all published announcements in chronological order
  describe('TC-006: Display Published Announcements', () => {
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

    it('should display announcements in chronological order (latest first)', () => {
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

    it('should display error message when fetch fails', () => {
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