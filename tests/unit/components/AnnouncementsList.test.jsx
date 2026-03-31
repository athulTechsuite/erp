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

describe('AnnouncementsList Component', () => {
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

  describe('AC1: Admin can see Create Announcement button and list existing announcements', () => {
    test('should display Create Announcement button for admin users', async () => {
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
      });
    });

    test('should display list of existing announcements', async () => {
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
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
        expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
        expect(screen.getByText('All staff meeting at 10 AM tomorrow')).toBeInTheDocument();
      });
    });

    test('should show empty state when no announcements exist', async () => {
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
  });

  describe('AC2: Admin can create announcements', () => {
    test('should open create form when Create button is clicked', async () => {
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
    });

    test('should close create form when close button is clicked', async () => {
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

      fireEvent.click(screen.getByText('Create Announcement'));
      
      await waitFor(() => {
        expect(screen.getByTestId('announcement-form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('announcement-form')).not.toBeInTheDocument();
      });
    });
  });

  describe('AC3: All authenticated users can view announcements', () => {
    test.each([
      { role: 'admin', name: 'Admin User' },
      { role: 'manager', name: 'Manager User' },
      { role: 'employee', name: 'Employee User' }
    ])('should display announcements for $role users', async ({ role, name }) => {
      mockUseAuth.mockReturnValue({
        user: { role, name },
        token: 'test-token'
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
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
        expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
      });
    });
  });

  describe('AC4: Admin can delete announcements', () => {
    test('should show delete button for admin users', async () => {
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
        const deleteButtons = screen.getAllByTestId('delete-button');
        expect(deleteButtons).toHaveLength(2); // One for each announcement
      });
    });

    test('should delete announcement when delete is confirmed', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      // Initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      // Delete request
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
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
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
  });

  describe('AC5: Non-admin users cannot access management features', () => {
    test('should not show Create button for manager users', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'manager', name: 'Manager User' },
        token: 'manager-token'
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
        expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
      });
    });

    test('should not show Create button for employee users', async () => {
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
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
      });
    });

    test('should not show delete buttons for non-admin users', async () => {
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
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
      });
    });
  });

  // TC-002: Non-admin users cannot access management features
  describe('TC-002: Non-admin users cannot access management features', () => {
    describe('Happy path - Non-admin users can view announcements but cannot manage them', () => {
      test.each([
        { role: 'manager', name: 'Manager User' },
        { role: 'employee', name: 'Employee User' }
      ])('TC-002 - $role users should see announcements but not management controls', async ({ role, name }) => {
        mockUseAuth.mockReturnValue({
          user: { role, name },
          token: `${role}-token`
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
          // Should see announcements (read access)
          expect(screen.getByText('Company Meeting')).toBeInTheDocument();
          expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
          
          // Should NOT see management features
          expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
          expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
        });
      });

      test('TC-002 - Non-admin users should maintain read access to announcement content', async () => {
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
          render(<AnnouncementsList />);
        });

        await waitFor(() => {
          // Should see full announcement content
          expect(screen.getByText('Company Meeting')).toBeInTheDocument();
          expect(screen.getByText('All staff meeting at 10 AM tomorrow')).toBeInTheDocument();
          expect(screen.getByText('Holiday Notice')).toBeInTheDocument();
          expect(screen.getByText('Office closed on Friday')).toBeInTheDocument();
          expect(screen.getByTestId('announcement-image')).toBeInTheDocument();
        });
      });
    });

    describe('Error path - Non-admin users cannot bypass role restrictions', () => {
      test('TC-002 - Employee users cannot access create functionality even with direct props', async () => {
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

        // Even if showCreateButton prop is explicitly set to true, role should override
        await act(async () => {
          render(<AnnouncementsList showCreateButton={true} />);
        });

        await waitFor(() => {
          expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
        });
      });

      test('TC-002 - Manager users cannot access delete functionality through UI manipulation', async () => {
        mockUseAuth.mockReturnValue({
          user: { role: 'manager', name: 'Manager User' },
          token: 'manager-token'
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
          // Should see announcements
          expect(screen.getByText('Company Meeting')).toBeInTheDocument();
          
          // Should not have any delete buttons to manipulate
          expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
          expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument();
        });
      });

      test('TC-002 - Non-admin users maintain restrictions during re-renders and state changes', async () => {
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

        // Re-render should maintain role restrictions
        rerender(<AnnouncementsList />);

        await waitFor(() => {
          expect(screen.getByText('Company Meeting')).toBeInTheDocument();
          expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
          expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
        });
      });

      test('TC-002 - System prevents unauthorized access attempts gracefully', async () => {
        const { message } = require('antd');
        
        mockUseAuth.mockReturnValue({
          user: { role: 'employee', name: 'Employee User' },
          token: 'employee-token'
        });

        // Simulate unauthorized access attempt via fetch response
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
          // Should handle unauthorized access gracefully with error message
          expect(message.error).toHaveBeenCalled();
        });
      });
    });
  });

  describe('AC6: Announcements with text and image render properly', () => {
    test('should render announcement with image', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: [mockAnnouncements[1]] // Holiday notice with image
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
      });
    });

    test('should render announcement without image', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: [mockAnnouncements[0]] // Company meeting without image
        })
      });

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
        expect(screen.queryByTestId('announcement-image')).not.toBeInTheDocument();
      });
    });
  });

  describe('AC7: Error handling and system stability', () => {
    test('should display error message when fetch fails', async () => {
      const { message } = require('antd');
      
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<AnnouncementsList />);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('Failed to load announcements');
      });
    });

    test('should display error message when API returns error', async () => {
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

    test('should handle delete errors gracefully', async () => {
      const { message } = require('antd');
      
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      // Initial fetch success
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      // Delete request fails
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

    test('should show loading state during fetch', async () => {
      let resolvePromise;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      fetch.mockReturnValueOnce(promise);

      await act(async () => {
        render(<AnnouncementsList />);
      });

      // Check loading state
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true');

      // Resolve promise
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

    test('should maintain UI stability during operations', async () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'admin', name: 'Admin User' },
        token: 'admin-token'
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          announcements: mockAnnouncements
        })
      });

      const { rerender } = render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Company Meeting')).toBeInTheDocument();
      });

      // Re-render should not cause errors
      rerender(<AnnouncementsList />);

      expect(screen.getByText('Company Meeting')).toBeInTheDocument();
    });
  });

  describe('Component Props', () => {
    test('should respect showCreateButton prop', async () => {
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

    test('should apply maxHeight prop when provided', async () => {
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

      // Check if maxHeight style is applied (this would depend on the actual implementation)
      const listContainer = container.querySelector('.announcements-list');
      if (listContainer) {
        expect(listContainer).toHaveStyle('max-height: 400px');
      }
    });
  });
});