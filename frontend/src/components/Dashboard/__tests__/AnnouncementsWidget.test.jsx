import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import AnnouncementsWidget from '../AnnouncementsWidget';
import '@testing-library/jest-dom';

// Mock the API calls
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token')
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock date formatting
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM dd, yyyy') {
      return 'Jan 15, 2024';
    }
    return 'Jan 15, 2024';
  })
}));

// TC-007: Dashboard widget tests - AnnouncementsWidget component
describe('AnnouncementsWidget - TC-007: Dashboard widget tests', () => {
  beforeEach(() => {
    fetch.mockClear();
    mockLocalStorage.getItem.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  const mockAnnouncements = [
    {
      id: 1,
      title: 'Company Update',
      content: 'Important announcement about company policies and procedures. This is a longer content to test truncation functionality.',
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Holiday Schedule',
      content: 'Upcoming holiday information for all employees.',
      created_at: '2024-01-14T09:00:00Z'
    },
    {
      id: 3,
      title: 'System Maintenance',
      content: 'Scheduled maintenance window this weekend.',
      created_at: '2024-01-13T08:00:00Z'
    }
  ];

  // TC-007 Happy Path Tests
  describe('TC-007 Happy Path Scenarios', () => {
    it('should display loading state initially', () => {
      fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<AnnouncementsWidget />);
      
      expect(screen.getByText('Loading announcements...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should display published announcements when API call succeeds', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
        expect(screen.getByText('Holiday Schedule')).toBeInTheDocument();
        expect(screen.getByText('System Maintenance')).toBeInTheDocument();
      });

      // Check that announcements are displayed with dates
      expect(screen.getAllByText('Jan 15, 2024')).toHaveLength(3);
      
      // Check that content is displayed (potentially truncated)
      expect(screen.getByText(/Important announcement about company policies/)).toBeInTheDocument();
      expect(screen.getByText('Upcoming holiday information for all employees.')).toBeInTheDocument();
    });

    it('should limit display to maximum 5 announcements', async () => {
      const manyAnnouncements = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        title: `Announcement ${i + 1}`,
        content: `Content for announcement ${i + 1}`,
        created_at: `2024-01-${15 - i}T10:00:00Z`
      }));

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => manyAnnouncements
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        const announcementCards = screen.getAllByTestId('announcement-card');
        expect(announcementCards).toHaveLength(5);
      });
    });

    it('should display announcements in reverse chronological order', async () => {
      const unsortedAnnouncements = [
        {
          id: 1,
          title: 'Old Announcement',
          content: 'Old content',
          created_at: '2024-01-10T10:00:00Z'
        },
        {
          id: 2,
          title: 'New Announcement',
          content: 'New content',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 3,
          title: 'Middle Announcement',
          content: 'Middle content',
          created_at: '2024-01-12T10:00:00Z'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => unsortedAnnouncements
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        const titles = screen.getAllByTestId('announcement-title');
        expect(titles[0]).toHaveTextContent('New Announcement');
        expect(titles[1]).toHaveTextContent('Middle Announcement');
        expect(titles[2]).toHaveTextContent('Old Announcement');
      });
    });

    it('should truncate long content with ellipsis', async () => {
      const longContentAnnouncement = [
        {
          id: 1,
          title: 'Long Content Announcement',
          content: 'This is a very long announcement content that should be truncated when displayed in the widget because it exceeds the maximum character limit of 200 characters for the preview in the dashboard widget display.',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => longContentAnnouncement
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        const content = screen.getByTestId('announcement-content');
        expect(content.textContent).toMatch(/\.\.\.$/);
        expect(content.textContent.length).toBeLessThanOrEqual(203); // 200 + '...'
      });
    });

    it('should make API call with correct authentication headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/published', {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          }
        });
      });
    });

    it('should display empty state when no announcements exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('No announcements at this time.')).toBeInTheDocument();
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should poll for updates every 30 seconds', async () => {
      jest.useFakeTimers();
      
      fetch.mockResolvedValue({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsWidget />);

      // Initial call
      expect(fetch).toHaveBeenCalledTimes(1);

      // Fast-forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Should make another API call
      expect(fetch).toHaveBeenCalledTimes(2);

      // Fast-forward another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(fetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should clean up polling interval on unmount', async () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      fetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });

      const { unmount } = render(<AnnouncementsWidget />);
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
      clearIntervalSpy.mockRestore();
    });
  });

  // TC-007 Error Path Tests
  describe('TC-007 Error Path Scenarios', () => {
    it('should display user-friendly error message when API fails', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load company announcements. Please try again later.')).toBeInTheDocument();
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Ensure the error doesn't break the widget
      expect(screen.getByText('Company Announcements')).toBeInTheDocument();
    });

    it('should display error message when API returns non-ok response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load company announcements. Please try again later.')).toBeInTheDocument();
      });
    });

    it('should handle API timeout errors gracefully', async () => {
      fetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 1000)
        )
      );

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load company announcements. Please try again later.')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should handle malformed API response gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load company announcements. Please try again later.')).toBeInTheDocument();
      });
    });

    it('should handle date formatting errors gracefully', async () => {
      const { format } = require('date-fns');
      format.mockImplementationOnce(() => {
        throw new Error('Invalid date');
      });

      const announcementWithInvalidDate = [
        {
          id: 1,
          title: 'Test Announcement',
          content: 'Test content',
          created_at: 'invalid-date'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => announcementWithInvalidDate
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Invalid date')).toBeInTheDocument();
      });
    });

    it('should handle missing authentication token gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      render(<AnnouncementsWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load company announcements. Please try again later.')).toBeInTheDocument();
      });
    });

    it('should handle polling errors without breaking the widget', async () => {
      jest.useFakeTimers();
      
      // First call succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      // Subsequent polling calls fail
      fetch.mockRejectedValue(new Error('Network error'));

      render(<AnnouncementsWidget />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Company Update')).toBeInTheDocument();
      });

      // Fast-forward to trigger polling
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Widget should still display the cached data, not error state
      expect(screen.getByText('Company Update')).toBeInTheDocument();
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();

      jest.useRealTimers();
    });
  });
});