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

  // TC-001: AnnouncementList component rendering and functionality - Happy Path Testing
  describe('TC-001: AnnouncementList component rendering and functionality - Happy Path', () => {
    test('should render AnnouncementList component with valid data successfully', async () => {
      render(<AnnouncementList />);

      // Verify component renders without crashing
      expect(screen.getByRole('region')).toBeInTheDocument();

      // Wait for announcements to load and verify they are displayed
      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
        expect(screen.getByText('Second Announcement')).toBeInTheDocument();
      });

      // Verify announcement content is displayed
      expect(screen.getByText('This is the first announcement content')).toBeInTheDocument();
      expect(screen.getByText('This is the second announcement content')).toBeInTheDocument();

      // Verify service was called correctly
      expect(announcementService.getAllAnnouncements).toHaveBeenCalledTimes(1);
    });

    test('should render AnnouncementList with proper sorting and date formatting', async () => {
      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      // Verify announcements are sorted by creation date (newest first)
      const announcements = screen.getAllByText(/Announcement/);
      expect(announcements[0]).toHaveTextContent('First Announcement');
      expect(announcements[1]).toHaveTextContent('Second Announcement');

      // Verify dates are formatted correctly
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 14, 2024/)).toBeInTheDocument();
    });

    test('should render AnnouncementList with admin actions when user is admin', async () => {
      useAuth.mockReturnValue({ user: mockAdminUser });
      
      render(<AnnouncementList showActions={true} />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      // Verify admin action buttons are rendered
      expect(screen.getAllByTestId(/edit-announcement/)).toHaveLength(2);
      expect(screen.getAllByTestId(/delete-announcement/)).toHaveLength(2);
    });

    test('should handle successful announcement deletion flow', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      useAuth.mockReturnValue({ user: mockAdminUser });
      
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

    test('should handle maxItems prop limitation correctly', async () => {
      render(<AnnouncementList maxItems={1} />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      // Verify only one announcement is displayed when maxItems is set
      expect(screen.queryByText('Second Announcement')).not.toBeInTheDocument();
    });

    test('should handle showActions prop correctly for non-admin users', async () => {
      render(<AnnouncementList showActions={true} />);

      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      // Verify no admin actions are shown for regular users
      expect(screen.queryByTestId(/edit-announcement/)).not.toBeInTheDocument();
      expect(screen.queryByTestId(/delete-announcement/)).not.toBeInTheDocument();
    });
  });

  // TC-001: AnnouncementList component rendering and functionality - Error Path Testing
  describe('TC-001: AnnouncementList component rendering and functionality - Error Path', () => {
    test('should handle rendering when API call fails gracefully', async () => {
      announcementService.getAllAnnouncements.mockRejectedValue(new Error('API Error'));

      render(<AnnouncementList />);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
      });

      // Verify component doesn't crash and renders error state
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(announcementService.getAllAnnouncements).toHaveBeenCalledTimes(1);
    });

    test('should handle rendering when no announcements data is available', async () => {
      announcementService.getAllAnnouncements.mockResolvedValue([]);

      render(<AnnouncementList />);

      // Verify empty state message is displayed
      await waitFor(() => {
        expect(screen.getByText(/No announcements/i)).toBeInTheDocument();
      });

      // Verify component renders without crashing
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    test('should handle rendering when user context is missing', async () => {
      useAuth.mockReturnValue({ user: null });

      render(<AnnouncementList />);

      // Verify component renders without crashing even with null user
      await waitFor(() => {
        expect(screen.getByText('First Announcement')).toBeInTheDocument();
      });

      // Verify no admin actions are shown for null user
      expect(screen.queryByTestId(/edit-announcement/)).not.toBeInTheDocument();
      expect(screen.queryByTestId(/delete-announcement/)).not.toBeInTheDocument();
    });

    test('should handle rendering with malformed announcement data', async () => {
      const malformedData = [
        { id: 1, title: null, content: '', createdAt: 'invalid-date' },
        { id: 2 } // Missing required fields
      ];
      announcementService.getAllAnnouncements.mockResolvedValue(malformedData);

      render(<AnnouncementList />);

      // Verify component handles malformed data gracefully
      await waitFor(() => {
        expect(announcementService.getAllAnnouncements).toHaveBeenCalled();
      });

      // Component should not crash with malformed data
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    test('should handle announcement deletion failure gracefully', async () => {
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

    test('should handle cancellation of announcement deletion', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      useAuth.mockReturnValue({ user: mockAdminUser });
      
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

    test('should handle network timeout errors gracefully', async () => {
      announcementService.getAllAnnouncements.mockRejectedValue(new Error('Network timeout'));

      render(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('should handle undefined or null response from service', async () => {
      announcementService.getAllAnnouncements.mockResolvedValue(null);

      render(<AnnouncementList />);

      // Component should handle null response gracefully
      await waitFor(() => {
        expect(announcementService.getAllAnnouncements).toHaveBeenCalled();
      });

      expect(screen.getByRole('region')).toBeInTheDocument();
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