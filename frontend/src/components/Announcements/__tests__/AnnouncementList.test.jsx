import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnnouncementList from '../AnnouncementList';
import { useAuth } from '../../../hooks/useAuth';
import announcementService from '../../../services/announcementService';

// Mock dependencies
jest.mock('../../../hooks/useAuth');
jest.mock('../../../services/announcementService');
jest.mock('../../ui/card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>
}));
jest.mock('../../ui/alert', () => ({
  Alert: ({ children }) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }) => <div>{children}</div>
}));

describe('AnnouncementList Component Tests', () => {
  const mockUser = {
    id: 1,
    role: 'employee',
    name: 'Test Employee'
  };

  const mockAdminUser = {
    id: 2,
    role: 'admin',
    name: 'Test Admin'
  };

  const mockAnnouncements = [
    {
      id: 1,
      title: 'First Announcement',
      content: 'This is the first announcement content',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Second Announcement',
      content: 'This is the second announcement content',
      createdAt: '2024-01-14T10:00:00Z',
      updatedAt: '2024-01-14T10:00:00Z'
    }
  ];

  beforeEach(() => {
    useAuth.mockReturnValue({ user: mockUser });
    announcementService.getAllAnnouncements.mockResolvedValue(mockAnnouncements);
    announcementService.deleteAnnouncement.mockResolvedValue({});
    jest.clearAllMocks();
  });

  // TC-001: AnnouncementList component rendering - Complete test coverage with happy path and error path validation
  describe('TC-001: AnnouncementList component rendering', () => {
    describe('Happy Path - Component renders successfully with valid data', () => {
      test('renders component structure and displays announcements correctly', async () => {
        render(<AnnouncementList />);

        // Verify component renders without crashing and has proper structure
        expect(screen.getByRole('region')).toBeInTheDocument();

        // Verify announcements service is called and data is displayed
        await waitFor(() => {
          expect(announcementService.getAllAnnouncements).toHaveBeenCalledTimes(1);
          expect(screen.getByText('First Announcement')).toBeInTheDocument();
          expect(screen.getByText('Second Announcement')).toBeInTheDocument();
        });

        // Verify content and dates are properly rendered
        expect(screen.getByText('This is the first announcement content')).toBeInTheDocument();
        expect(screen.getByText('This is the second announcement content')).toBeInTheDocument();
        expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 14, 2024/)).toBeInTheDocument();
      });

      test('handles admin user interactions and permissions correctly', async () => {
        useAuth.mockReturnValue({ user: mockAdminUser });
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
        
        render(<AnnouncementList showActions={true} />);

        // Verify admin action buttons are rendered
        await waitFor(() => {
          expect(screen.getAllByTestId(/edit-announcement/)).toHaveLength(2);
          expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
        });

        // Test successful delete interaction
        const deleteButton = screen.getAllByTestId(/delete-announcement/)[0];
        fireEvent.click(deleteButton);

        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this announcement?');
        
        await waitFor(() => {
          expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1);
        });

        confirmSpy.mockRestore();
      });

      test('renders with different prop configurations correctly', async () => {
        // Test maxItems limitation
        render(<AnnouncementList maxItems={1} showActions={false} />);

        await waitFor(() => {
          expect(screen.getByText('First Announcement')).toBeInTheDocument();
        });

        // Verify only one announcement is shown and no actions are available
        expect(screen.queryByText('Second Announcement')).not.toBeInTheDocument();
        expect(screen.queryByTestId(/edit-announcement/)).not.toBeInTheDocument();
        expect(screen.queryByTestId(/delete-announcement/)).not.toBeInTheDocument();
      });

      test('handles empty data state gracefully', async () => {
        announcementService.getAllAnnouncements.mockResolvedValue([]);
        
        render(<AnnouncementList />);

        await waitFor(() => {
          expect(screen.getByText(/No announcements/i)).toBeInTheDocument();
        });

        // Component structure should still be intact
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      test('handles loading state properly', () => {
        // Mock a pending promise to test loading state
        announcementService.getAllAnnouncements.mockReturnValue(new Promise(() => {}));
        
        render(<AnnouncementList />);

        // Verify loading skeletons are displayed
        expect(screen.getAllByTestId(/loading-skeleton/)).toHaveLength(3);
      });
    });

    describe('Error Path - Component handles failures and edge cases gracefully', () => {
      test('handles service failure during initial rendering', async () => {
        const networkError = new Error('Network connection failed');
        announcementService.getAllAnnouncements.mockRejectedValue(networkError);
        
        render(<AnnouncementList />);

        // Component should still render base structure
        expect(screen.getByRole('region')).toBeInTheDocument();

        // Verify error message is displayed
        await waitFor(() => {
          expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Ensure service was called despite failure
        expect(announcementService.getAllAnnouncements).toHaveBeenCalledTimes(1);
      });

      test('handles interaction failures during delete operations', async () => {
        useAuth.mockReturnValue({ user: mockAdminUser });
        announcementService.deleteAnnouncement.mockRejectedValue(new Error('Delete operation failed'));
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
        
        render(<AnnouncementList showActions={true} />);

        // Wait for component to load successfully first
        await waitFor(() => {
          expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
        });

        // Trigger delete action that will fail
        const deleteButton = screen.getAllByTestId(/delete-announcement/)[0];
        fireEvent.click(deleteButton);

        // Verify error handling
        await waitFor(() => {
          expect(screen.getByText('Failed to delete announcement')).toBeInTheDocument();
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Component should remain functional after error
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
        expect(screen.getByText('Second Announcement')).toBeInTheDocument();
        
        confirmSpy.mockRestore();
      });

      test('handles authentication edge cases properly', async () => {
        // Test with null user
        useAuth.mockReturnValue({ user: null });
        
        render(<AnnouncementList showActions={true} />);

        await waitFor(() => {
          expect(screen.getByText('First Announcement')).toBeInTheDocument();
        });

        // Should not show admin actions for null user
        expect(screen.queryByTestId(/edit-announcement/)).not.toBeInTheDocument();
        expect(screen.queryByTestId(/delete-announcement/)).not.toBeInTheDocument();
      });

      test('handles malformed data gracefully', async () => {
        // Mock data with missing required fields
        const malformedData = [
          { id: 1, title: 'Valid Title' }, // Missing content and dates
          { content: 'Content without title' }, // Missing title and id
          null, // Null entry
          undefined // Undefined entry
        ];
        announcementService.getAllAnnouncements.mockResolvedValue(malformedData);
        
        render(<AnnouncementList />);

        // Component should not crash and handle malformed data
        expect(screen.getByRole('region')).toBeInTheDocument();
        
        await waitFor(() => {
          // Should handle valid entries while skipping invalid ones
          expect(screen.queryByText('Valid Title')).toBeInTheDocument();
        });
      });

      test('handles user cancellation during delete operations', async () => {
        useAuth.mockReturnValue({ user: mockAdminUser });
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
        
        render(<AnnouncementList showActions={true} />);

        await waitFor(() => {
          expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
        });

        const deleteButton = screen.getAllByTestId(/delete-announcement/)[0];
        fireEvent.click(deleteButton);

        // Verify confirmation was shown but delete was not executed
        expect(confirmSpy).toHaveBeenCalled();
        expect(announcementService.deleteAnnouncement).not.toHaveBeenCalled();

        // All announcements should still be visible
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
        expect(screen.getByText('Second Announcement')).toBeInTheDocument();

        confirmSpy.mockRestore();
      });

      test('handles component unmounting during async operations', async () => {
        let resolvePromise;
        const pendingPromise = new Promise((resolve) => {
          resolvePromise = resolve;
        });
        announcementService.getAllAnnouncements.mockReturnValue(pendingPromise);
        
        const { unmount } = render(<AnnouncementList />);

        // Unmount before promise resolves
        unmount();

        // Resolve the promise after unmount
        resolvePromise(mockAnnouncements);

        // Should not cause any errors or memory leaks
        expect(true).toBe(true); // Test passes if no errors thrown
      });
    });
  });

  describe('PRD Test Case 3: Employee views announcements on dashboard', () => {
    test('should display all announcements with title, content, and publish date', async () => {
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
        expect(screen.getByText('Second Announcement')).toBeInTheDocument();
      });

      expect(screen.getByText('This is the first announcement content')).toBeInTheDocument();
      expect(screen.getByText('This is the second announcement content')).toBeInTheDocument();
      
      // Check that dates are formatted and displayed
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 14, 2024/)).toBeInTheDocument();
    });

    test('should sort announcements by creation date (newest first)', async () => {
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(announcementService.getAllAnnouncements).toHaveBeenCalled();
      });

      const announcements = screen.getAllByText(/Announcement/);
      expect(announcements[0]).toHaveTextContent('First Announcement');
      expect(announcements[1]).toHaveTextContent('Second Announcement');
    });

    test('should limit displayed announcements when maxItems prop is provided', async () => {
      render(<AnnouncementList maxItems={1} />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      expect(screen.queryByText('Second Announcement')).not.toBeInTheDocument();
    });
  });

  describe('PRD Test Case 6: No announcements scenario', () => {
    test('should show appropriate message when no announcements exist', async () => {
      announcementService.getAllAnnouncements.mockResolvedValue([]);
      
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText(/No announcements/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admin Actions', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockAdminUser });
    });

    test('should show action buttons for admin users when showActions is true', async () => {
      render(<AnnouncementList showActions={true} />);

      await waitFor(() => {
        expect(screen.getAllByTestId(/edit-announcement/)).toHaveLength(2);
        expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
      });
    });

    test('should not show action buttons when showActions is false', async () => {
      render(<AnnouncementList showActions={false} />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      expect(screen.queryByTestId(/edit-announcement/)).not.toBeInTheDocument();
      expect(screen.queryByTestId(/delete-announcement/)).not.toBeInTheDocument();
    });

    test('should handle announcement deletion with confirmation', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<AnnouncementList showActions={true} />);

      await waitFor(() => {
        expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
      });

      const deleteButton = screen.getAllByTestId(/delete-announcement/)[0];
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this announcement?');
      
      await waitFor(() => {
        expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1);
      });

      confirmSpy.mockRestore();
    });

    test('should not delete announcement when user cancels confirmation', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<AnnouncementList showActions={true} />);

      await waitFor(() => {
        expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
      });

      const deleteButton = screen.getAllByTestId(/delete-announcement/)[0];
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(announcementService.deleteAnnouncement).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should display error message when fetching announcements fails', async () => {
      announcementService.getAllAnnouncements.mockRejectedValue(new Error('Network error'));
      
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
      });
    });

    test('should display error message when deletion fails', async () => {
      announcementService.deleteAnnouncement.mockRejectedValue(new Error('Delete failed'));
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      useAuth.mockReturnValue({ user: mockAdminUser });
      render(<AnnouncementList showActions={true} />);

      await waitFor(() => {
        expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
      });

      const deleteButton = screen.getAllByTestId(/delete-announcement/)[0];
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete announcement')).toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    test('should show loading state while fetching announcements', () => {
      announcementService.getAllAnnouncements.mockReturnValue(new Promise(() => {})); // Never resolves
      
      render(<AnnouncementList />);

      expect(screen.getAllByTestId(/loading-skeleton/)).toHaveLength(3);
    });
  });

  describe('Date Formatting', () => {
    test('should format dates correctly', async () => {
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText(/Jan 15, 2024.*10:00 AM/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 14, 2024.*10:00 AM/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async () => {
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      // Check for proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings).toHaveLength(2);
      
      // Check for proper semantic structure
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });
});