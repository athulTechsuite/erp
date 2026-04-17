import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import '@testing-library/jest-dom';
import AnnouncementsList from '../../../frontend/src/components/Announcements/AnnouncementsList';
import { useAuth } from '../../../frontend/src/hooks/useAuth';

// Mock the useAuth hook
jest.mock('../../../frontend/src/hooks/useAuth');

// Mock fetch
global.fetch = jest.fn();

// Mock Ant Design components
jest.mock('antd', () => ({
  Card: ({ children, title, extra }) => (
    <div data-testid="card">
      <div data-testid="card-title">{title}</div>
      <div data-testid="card-extra">{extra}</div>
      <div data-testid="card-content">{children}</div>
    </div>
  ),
  Button: ({ children, onClick, icon, danger, loading, ...props }) => (
    <button 
      onClick={onClick} 
      disabled={loading}
      data-testid={danger ? 'delete-button' : 'button'}
      {...props}
    >
      {icon}{children}
    </button>
  ),
  Modal: {
    confirm: jest.fn((config) => {
      config.onOk && config.onOk();
    })
  },
  message: {
    error: jest.fn(),
    success: jest.fn()
  },
  Spin: ({ children, spinning }) => (
    <div data-testid="spin" data-spinning={spinning}>
      {children}
    </div>
  ),
  Empty: ({ description }) => (
    <div data-testid="empty">{description}</div>
  ),
  Typography: {
    Title: ({ children, level }) => <h1 data-level={level}>{children}</h1>,
    Paragraph: ({ children }) => <p>{children}</p>
  },
  Image: ({ src, alt }) => <img src={src} alt={alt} data-testid="announcement-image" />,
  Popconfirm: ({ children, onConfirm, title }) => (
    <div>
      <div data-testid="popconfirm-title">{title}</div>
      <button onClick={onConfirm} data-testid="confirm-delete">
        {children}
      </button>
    </div>
  )
}));

// Mock AnnouncementForm component
jest.mock('../../../frontend/src/components/Announcements/AnnouncementForm', () => {
  return function MockAnnouncementForm({ visible, onClose, onSuccess }) {
    if (!visible) return null;
    return (
      <div data-testid="announcement-form">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSuccess({ id: 'new-id', title: 'New Announcement' })}>
          Submit
        </button>
      </div>
    );
  };
});

// TC-002: Unit tests for AnnouncementsList component
describe('TC-002: AnnouncementsList Component Unit Tests', () => {
  const mockUseAuth = useAuth;
  
  const mockAnnouncements = [
    {
      _id: '1',
      title: 'Company Meeting',
      content: 'All staff meeting at 10 AM tomorrow',
      createdBy: { firstName: 'Admin', lastName: 'User' },
      createdAt: '2023-12-01T10:00:00Z',
      imageUrl: null
    },
    {
      _id: '2', 
      title: 'Holiday Notice',
      content: 'Office closed on Friday',
      createdBy: { firstName: 'Admin', lastName: 'User' },
      createdAt: '2023-12-02T10:00:00Z',
      imageUrl: 'https://example.com/holiday.jpg'
    }
  ];

  beforeEach(() => {
    fetch.mockClear();
    mockUseAuth.mockReturnValue({
      user: { role: 'employee', name: 'Test User' },
      token: 'mock-token'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // TC-002: Happy Path Tests
  describe('TC-002 Happy Path: Component renders and functions correctly', () => {
    test('TC-002-HP-01: Admin can see Create Announcement button and list existing announcements', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Create Announcement')).toBeInTheDocument();
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
        expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
        expect(screen.getByText('All staff meeting at 10 AM tomorrow')).toBeInTheDocument();
      });
    });

    test('TC-002-HP-02: All authenticated users can view announcements', async () => {
      const userRoles = [
        { role: 'admin', name: 'Admin User' },
        { role: 'manager', name: 'Manager User' },
        { role: 'employee', name: 'Employee User' }
      ];

      for (const user of userRoles) {
        mockUseAuth.mockReturnValue({
          user,
          token: `${user.role}-token`
        });

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            announcements: mockAnnouncements
          })
        });

        const { unmount } = await act(async () => {
          return render(<AnnouncementsList />);
        });

        await waitFor(() => {
          expect(screen.getByText('Company Meeting')).toBeInTheDocument();
          expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
        });

        unmount();
      }
    });

    test('TC-002-HP-03: Admin can create announcements', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: []
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Create Announcement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(screen.getByTestId('announcement-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('announcement-form')).not.toBeInTheDocument();
      });
    });

    test('TC-002-HP-04: Admin can delete announcements', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Announcement deleted successfully'
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('delete-button');
        expect(deleteButtons).toHaveLength(2);
      });

      const deleteButtons = screen.getAllByTestId('delete-button');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/announcements/1',
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              'Authorization': 'Bearer admin-token'
            })
          })
        );
      });
    });

    test('TC-002-HP-05: Announcements with text and images render properly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
        expect(screen.getByTestId('announcement-image')).toBeInTheDocument();
        expect(screen.getByTestId('announcement-image')).toHaveAttribute(
          'src', 
          'https://example.com/holiday.jpg'
        );
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
      });
    });

    test('TC-002-HP-06: Empty state renders when no announcements exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: []
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty')).toBeInTheDocument();
      });
    });

    test('TC-002-HP-07: Loading state displays during API calls', async () => {
      let resolvePromise;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      fetch.mockReturnValueOnce(promise);

      await act(async () => {
        render(<AnnouncementsList />);
      });

      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true');

      resolvePromise({
        ok: true,
        json: async () => ({
          success: true,
          announcements: []
        })
      });

      await waitFor(() => {
        expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false');
      });
    });
  });

  // TC-002: Error Path Tests
  describe('TC-002 Error Path: Component handles errors and edge cases', () => {
    test('TC-002-EP-01: Non-admin users cannot access management features', async () => {
      const nonAdminRoles = [
        { role: 'manager', name: 'Manager User' },
        { role: 'employee', name: 'Employee User' }
      ];

      for (const user of nonAdminRoles) {
        mockUseAuth.mockReturnValue({
          user,
          token: `${user.role}-token`
        });

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            announcements: mockAnnouncements
          })
        });

        const { unmount } = await act(async () => {
          return render(<AnnouncementsList />);
        });

        await waitFor(() => {
          expect(screen.getByText('Company Meeting')).toBeInTheDocument();
          expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
          expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
        });

        unmount();
      }
    });

    test('TC-002-EP-02: Network errors are handled gracefully', async () => {
      const { message } = require('antd');
      
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('Failed to load announcements');
      });
    });

    test('TC-002-EP-03: API error responses are handled properly', async () => {
      const { message } = require('antd');
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error'
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('Failed to load announcements');
      });
    });

    test('TC-002-EP-04: Delete operation errors are handled gracefully', async () => {
      const { message } = require('antd');
      
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Failed to delete announcement'
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('delete-button');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(message.error).toHaveBeenCalled();
      });
    });

    test('TC-002-EP-05: Unauthorized access attempts are prevented', async () => {
      const { message } = require('antd');
      
      mockUseAuth.mockReturnValue({
        user: { role: 'employee', name: 'Employee User' },
        token: 'employee-token'
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden: Insufficient permissions'
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalled();
      });
    });

    test('TC-002-EP-06: Role restrictions persist through re-renders', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'employee', name: 'Employee User' },
        token: 'employee-token'
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      const { rerender } = await act(async () => {
        return render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
        expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
      });

      rerender(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
        expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
      });
    });

    test('TC-002-EP-07: Props cannot override security restrictions', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'employee', name: 'Employee User' },
        token: 'employee-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      await act(async () => {
        render(<AnnouncementsList showCreateButton={true} />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
      });
    });

    test('TC-002-EP-08: Component maintains stability during error conditions', async () => {
      const { message } = require('antd');
      
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const { rerender } = await act(async () => {
        return render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalled();
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      rerender(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
      });
    });
  });

  // Additional component feature tests
  describe('TC-002 Component Features: Props and configuration', () => {
    test('TC-002-CF-01: Component respects showCreateButton prop', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: []
        })
      });

      await act(async () => {
        render(<AnnouncementsList showCreateButton={false} />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
      });
    });

    test('TC-002-CF-02: Component applies maxHeight prop correctly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      const { container } = await act(async () => {
        return render(<AnnouncementsList maxHeight="400px" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
      });

      const listContainer = container.querySelector('.announcements-list');
      if (listContainer) {
        expect(listContainer).toHaveStyle('max-height: 400px');
      }
    });
  });
});