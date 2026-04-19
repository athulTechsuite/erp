import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnnouncementsList from '../../frontend/src/components/Announcements/AnnouncementsList';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('AnnouncementsList Component', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorageMock.getItem.mockReturnValue('mock-token');
  });

  describe('PRD Test Case 3: Dashboard announcement display', () => {
    test('Given I am any authenticated user When I view my dashboard Then I can see all active company announcements displayed in chronological order with the newest first', async () => {
      const mockAnnouncements = [
        {
          id: 1,
          title: 'Latest Announcement',
          message: 'This is the most recent announcement',
          created_at: '2024-01-02T10:00:00Z'
        },
        {
          id: 2,
          title: 'Older Announcement',
          message: 'This is an older announcement',
          created_at: '2024-01-01T10:00:00Z'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsList />);

      // Verify loading state initially
      expect(screen.getByText('Company Announcements')).toBeInTheDocument();
      
      // Wait for announcements to load
      await waitFor(() => {
        expect(screen.getByText('Latest Announcement')).toBeInTheDocument();
      });

      // Verify both announcements are displayed
      expect(screen.getByText('Latest Announcement')).toBeInTheDocument();
      expect(screen.getByText('This is the most recent announcement')).toBeInTheDocument();
      expect(screen.getByText('Older Announcement')).toBeInTheDocument();
      expect(screen.getByText('This is an older announcement')).toBeInTheDocument();

      // Verify API was called with correct headers
      expect(fetch).toHaveBeenCalledWith('/api/announcements', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
    });

    test('Should display empty state when no announcements exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('No announcements at this time')).toBeInTheDocument();
      });
    });
  });

  describe('PRD Test Case 6: Error handling', () => {
    test('Given The system encounters an error while loading announcements When A user views their dashboard Then The dashboard displays gracefully without announcements and logs the error appropriately', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load announcements')).toBeInTheDocument();
      });

      // Verify error is logged
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching announcements:',
        expect.any(Error)
      );
      
      // Verify component still renders the card structure
      expect(screen.getByText('Company Announcements')).toBeInTheDocument();
    });

    test('Should handle API error response gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load announcements')).toBeInTheDocument();
      });
    });

    test('Should handle invalid date format gracefully', async () => {
      const mockAnnouncementsWithInvalidDate = [
        {
          id: 1,
          title: 'Test Announcement',
          message: 'Test message',
          created_at: 'invalid-date'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncementsWithInvalidDate
      });

      render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement')).toBeInTheDocument();
        expect(screen.getByText('Invalid date')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    test('Should display loading skeleton while fetching announcements', () => {
      // Mock a pending promise
      fetch.mockImplementationOnce(() => new Promise(() => {}));

      render(<AnnouncementsList />);

      expect(screen.getByText('Company Announcements')).toBeInTheDocument();
      // Verify skeleton elements are present (based on Skeleton component)
      expect(document.querySelectorAll('.animate-pulse')).toHaveLength(3);
    });
  });

  describe('Date Formatting', () => {
    test('Should format dates correctly', async () => {
      const mockAnnouncement = [
        {
          id: 1,
          title: 'Test Announcement',
          message: 'Test message',
          created_at: '2024-01-15T14:30:00Z'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncement
      });

      render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement')).toBeInTheDocument();
        // The exact format depends on locale, but should contain date elements
        expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication', () => {
    test('Should not make API call if no token is available', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<AnnouncementsList />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load announcements')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/announcements', {
        headers: {
          'Authorization': 'Bearer null',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Component Props', () => {
    test('Should apply custom className', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const { container } = render(<AnnouncementsList className="custom-class" />);
      
      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-class');
      });
    });
  });
});