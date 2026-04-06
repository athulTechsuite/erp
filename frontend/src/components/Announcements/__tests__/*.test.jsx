import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import Announcements from '../Announcements';

// Mock dependencies
const mockAnnouncements = [
  {
    id: 1,
    title: 'Test Announcement 1',
    content: 'This is test content 1',
    priority: 'high',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    title: 'Test Announcement 2',
    content: 'This is test content 2',
    priority: 'medium',
    createdAt: '2024-01-02T00:00:00Z'
  }
];

const mockProps = {
  announcements: mockAnnouncements,
  onDismiss: jest.fn(),
  onMarkAsRead: jest.fn(),
  loading: false,
  error: null
};

describe('Announcements Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-002: Frontend component testing - Happy Path
  describe('TC-002: Frontend component testing - Happy Path', () => {
    it('should render announcements list correctly', () => {
      render(<Announcements {...mockProps} />);
      
      expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      expect(screen.getByText('Test Announcement 2')).toBeInTheDocument();
      expect(screen.getByText('This is test content 1')).toBeInTheDocument();
      expect(screen.getByText('This is test content 2')).toBeInTheDocument();
    });

    it('should handle dismiss interaction correctly', async () => {
      render(<Announcements {...mockProps} />);
      
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButtons[0]);
      
      await waitFor(() => {
        expect(mockProps.onDismiss).toHaveBeenCalledWith(1);
      });
    });

    it('should handle mark as read interaction correctly', async () => {
      render(<Announcements {...mockProps} />);
      
      const markAsReadButtons = screen.getAllByRole('button', { name: /mark as read/i });
      fireEvent.click(markAsReadButtons[0]);
      
      await waitFor(() => {
        expect(mockProps.onMarkAsRead).toHaveBeenCalledWith(1);
      });
    });

    it('should display priority levels correctly', () => {
      render(<Announcements {...mockProps} />);
      
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
    });

    it('should render empty state when no announcements', () => {
      const emptyProps = { ...mockProps, announcements: [] };
      render(<Announcements {...emptyProps} />);
      
      expect(screen.getByText(/no announcements/i)).toBeInTheDocument();
    });
  });

  // TC-002: Frontend component testing - Error Path
  describe('TC-002: Frontend component testing - Error Path', () => {
    it('should display error message when error prop is provided', () => {
      const errorProps = { ...mockProps, error: 'Failed to load announcements' };
      render(<Announcements {...errorProps} />);
      
      expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
    });

    it('should display loading state correctly', () => {
      const loadingProps = { ...mockProps, loading: true };
      render(<Announcements {...loadingProps} />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle dismiss interaction failure gracefully', async () => {
      const onDismissError = jest.fn().mockRejectedValue(new Error('Dismiss failed'));
      const errorProps = { ...mockProps, onDismiss: onDismissError };
      
      render(<Announcements {...errorProps} />);
      
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButtons[0]);
      
      await waitFor(() => {
        expect(onDismissError).toHaveBeenCalledWith(1);
      });
    });

    it('should handle mark as read interaction failure gracefully', async () => {
      const onMarkAsReadError = jest.fn().mockRejectedValue(new Error('Mark as read failed'));
      const errorProps = { ...mockProps, onMarkAsRead: onMarkAsReadError };
      
      render(<Announcements {...errorProps} />);
      
      const markAsReadButtons = screen.getAllByRole('button', { name: /mark as read/i });
      fireEvent.click(markAsReadButtons[0]);
      
      await waitFor(() => {
        expect(onMarkAsReadError).toHaveBeenCalledWith(1);
      });
    });

    it('should handle malformed announcement data gracefully', () => {
      const malformedProps = {
        ...mockProps,
        announcements: [
          { id: null, title: '', content: null },
          { id: 'invalid', title: undefined, priority: 'invalid' }
        ]
      };
      
      expect(() => render(<Announcements {...malformedProps} />)).not.toThrow();
    });

    it('should handle missing callback functions gracefully', () => {
      const incompleteProps = {
        announcements: mockAnnouncements,
        loading: false,
        error: null
      };
      
      expect(() => render(<Announcements {...incompleteProps} />)).not.toThrow();
    });
  });
});