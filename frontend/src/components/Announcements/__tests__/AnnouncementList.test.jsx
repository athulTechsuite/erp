import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AnnouncementList from '../AnnouncementList';
import { AuthContext } from '../../../contexts/AuthContext';
import { announcementService } from '../../../services/announcementService';
import '@testing-library/jest-dom';

// Mock the announcement service
jest.mock('../../../services/announcementService');

// Mock the auth context
const mockAuthContext = {
  user: {
    id: 1,
    name: 'Test User',
    email: 'test@company.com',
    role: 'employee'
  }
};

const mockAdminAuthContext = {
  user: {
    id: 2,
    name: 'Admin User', 
    email: 'admin@company.com',
    role: 'admin'
  }
};

const renderWithProviders = (component, authContext = mockAuthContext) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authContext}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('AnnouncementList Component', () => {
  const mockAnnouncements = [
    {
      id: 1,
      title: 'Company Update',
      content: '<p>Regular company update with <strong>important</strong> information.</p>',
      priority: 'normal',
      publishDate: '2024-01-15T10:00:00Z',
      expirationDate: '2024-01-22T10:00:00Z',
      author: { name: 'HR Admin', email: 'hr@company.com' },
      isRead: false,
      createdAt: '2024-01-15T09:00:00Z'
    },
    {
      id: 2,
      title: 'URGENT: System Maintenance',
      content: '<p>Emergency system maintenance tonight.</p>',
      priority: 'urgent',
      publishDate: '2024-01-15T14:00:00Z',
      expirationDate: '2024-01-16T23:59:59Z',
      author: { name: 'IT Admin', email: 'it@company.com' },
      isRead: true,
      createdAt: '2024-01-15T13:30:00Z'
    },
    {
      id: 3,
      title: 'Priority: New Policy Update',
      content: '<h2>Policy Changes</h2><ul><li>Updated vacation policy</li><li>New remote work guidelines</li></ul>',
      priority: 'priority',
      publishDate: '2024-01-14T09:00:00Z',
      expirationDate: '2024-01-28T23:59:59Z',
      author: { name: 'Policy Team', email: 'policy@company.com' },
      isRead: false,
      createdAt: '2024-01-14T08:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    announcementService.getAnnouncements.mockResolvedValue(mockAnnouncements);
  });

  // TC-003: Employees can view all active announcements in dedicated section
  describe('TC-003: View Active Announcements', () => {
    it('should display all active announcements', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
        expect(screen.getByText('URGENT: System Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Priority: New Policy Update')).toBeInTheDocument();
      });

      expect(announcementService.getAnnouncements).toHaveBeenCalledTimes(1);
    });

    it('should show loading state while fetching announcements', async () => {
      announcementService.getAnnouncements.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockAnnouncements), 100))
      );

      renderWithProviders(<AnnouncementList />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
    });

    it('should handle error when fetching announcements fails', async () => {
      announcementService.getAnnouncements.mockRejectedValue(new Error('Failed to fetch'));

      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
      });
    });
  });

  // TC-004: Rich text formatting support
  describe('TC-004: Rich Text Display', () => {
    it('should render rich text content with proper formatting', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        // Check for bold text in first announcement
        const importantText = screen.getByText('important');
        expect(importantText.tagName).toBe('STRONG');

        // Check for heading in third announcement
        expect(screen.getByText('Policy Changes')).toBeInTheDocument();
        
        // Check for list items
        expect(screen.getByText('Updated vacation policy')).toBeInTheDocument();
        expect(screen.getByText('New remote work guidelines')).toBeInTheDocument();
      });
    });
  });

  // TC-005: Priority and urgent announcements with visual indicators
  describe('TC-005: Priority Visual Indicators', () => {
    it('should display urgent announcements with warning indicators', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const urgentAnnouncement = screen.getByText('URGENT: System Maintenance').closest('[data-testid="announcement-card"]');
        expect(urgentAnnouncement).toHaveClass('urgent');
        expect(urgentAnnouncement.querySelector('[data-testid="urgent-icon"]')).toBeInTheDocument();
      });
    });

    it('should display priority announcements with priority indicators', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const priorityAnnouncement = screen.getByText('Priority: New Policy Update').closest('[data-testid="announcement-card"]');
        expect(priorityAnnouncement).toHaveClass('priority');
        expect(priorityAnnouncement.querySelector('[data-testid="priority-badge"]')).toBeInTheDocument();
      });
    });

    it('should sort announcements by priority (urgent, priority, normal)', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const announcementCards = screen.getAllByTestId('announcement-card');
        
        // Should be sorted: urgent first, then priority, then normal
        expect(announcementCards[0]).toHaveTextContent('URGENT: System Maintenance');
        expect(announcementCards[1]).toHaveTextContent('Priority: New Policy Update');
        expect(announcementCards[2]).toHaveTextContent('Company Update');
      });
    });
  });

  // TC-006: Read/Unread status functionality
  describe('TC-006: Read/Unread Status', () => {
    it('should show visual indicators for read/unread status', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const unreadAnnouncement = screen.getByText('Company Update').closest('[data-testid="announcement-card"]');
        const readAnnouncement = screen.getByText('URGENT: System Maintenance').closest('[data-testid="announcement-card"]');
        
        expect(unreadAnnouncement).toHaveClass('unread');
        expect(readAnnouncement).not.toHaveClass('unread');
        
        expect(unreadAnnouncement.querySelector('[data-testid="unread-indicator"]')).toBeInTheDocument();
        expect(readAnnouncement.querySelector('[data-testid="unread-indicator"]')).not.toBeInTheDocument();
      });
    });

    it('should allow marking announcement as read', async () => {
      announcementService.markAsRead.mockResolvedValue();
      
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const markReadButton = screen.getAllByTestId('mark-read-button')[0];
        fireEvent.click(markReadButton);
      });

      await waitFor(() => {
        expect(announcementService.markAsRead).toHaveBeenCalledWith(1);
      });
    });

    it('should allow marking announcement as unread', async () => {
      announcementService.markAsUnread.mockResolvedValue();
      
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const markUnreadButton = screen.getAllByTestId('mark-unread-button')[0];
        fireEvent.click(markUnreadButton);
      });

      await waitFor(() => {
        expect(announcementService.markAsUnread).toHaveBeenCalledWith(2);
      });
    });
  });

  // TC-007: Admin edit/delete functionality
  describe('TC-007: Admin Actions', () => {
    it('should show edit and delete buttons for admin users', async () => {
      renderWithProviders(<AnnouncementList />, mockAdminAuthContext);

      await waitFor(() => {
        expect(screen.getAllByTestId('edit-button')).toHaveLength(3);
        expect(screen.getAllByTestId('delete-button')).toHaveLength(3);
      });
    });

    it('should hide edit and delete buttons for non-admin users', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
      });
    });

    it('should handle announcement deletion', async () => {
      announcementService.deleteAnnouncement.mockResolvedValue();
      window.confirm = jest.fn(() => true);
      
      renderWithProviders(<AnnouncementList />, mockAdminAuthContext);

      await waitFor(() => {
        const deleteButton = screen.getAllByTestId('delete-button')[0];
        fireEvent.click(deleteButton);
      });

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this announcement?');
      
      await waitFor(() => {
        expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1);
      });
    });
  });

  // TC-010: Mobile responsive design
  describe('TC-010: Mobile Responsive Design', () => {
    it('should adapt layout for mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const announcementList = screen.getByTestId('announcement-list');
        expect(announcementList).toHaveClass('mobile-layout');
        
        // Check that cards stack vertically on mobile
        const announcementCards = screen.getAllByTestId('announcement-card');
        announcementCards.forEach(card => {
          expect(card).toHaveClass('mobile-card');
        });
      });
    });

    it('should show condensed view on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true, 
        value: 320,
      });

      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        // Author information should be hidden on small screens
        const authorInfo = screen.queryAllByTestId('author-info');
        authorInfo.forEach(info => {
          expect(info).toHaveClass('hidden-mobile');
        });
        
        // Timestamps should be shortened
        expect(screen.getByText('Jan 15')).toBeInTheDocument(); // Shortened date format
      });
    });
  });

  // Filter functionality tests
  describe('Announcement Filtering', () => {
    it('should filter announcements by read status', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const filterSelect = screen.getByTestId('filter-select');
        fireEvent.change(filterSelect, { target: { value: 'unread' } });
      });

      await waitFor(() => {
        // Should only show unread announcements
        expect(screen.getByText('Company Update')).toBeInTheDocument();
        expect(screen.getByText('Priority: New Policy Update')).toBeInTheDocument();
        expect(screen.queryByText('URGENT: System Maintenance')).not.toBeInTheDocument();
      });
    });

    it('should filter announcements by priority', async () => {
      renderWithProviders(<AnnouncementList />);

      await waitFor(() => {
        const filterSelect = screen.getByTestId('filter-select');
        fireEvent.change(filterSelect, { target: { value: 'urgent' } });
      });

      await waitFor(() => {
        // Should only show urgent announcements
        expect(screen.getByText('URGENT: System Maintenance')).toBeInTheDocument();
        expect(screen.queryByText('Company Update')).not.toBeInTheDocument();
        expect(screen.queryByText('Priority: New Policy Update')).not.toBeInTheDocument();
      });
    });
  });
});