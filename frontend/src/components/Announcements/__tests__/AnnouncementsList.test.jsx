import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import AnnouncementsList from '../AnnouncementsList';
import { useAuth } from '../../../hooks/useAuth';
import { announcementService } from '../../../services/announcementService';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../hooks/useAuth');
jest.mock('../../../services/announcementService');
jest.mock('date-fns', () => ({
  format: jest.fn((date) => '2024-01-15 10:30 AM')
}));

// Mock UI components
jest.mock('../../ui/card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h3>{children}</h3>
}));

jest.mock('../../ui/button', () => ({
  Button: ({ children, onClick, className }) => (
    <button onClick={onClick} className={className}>{children}</button>
  )
}));

const mockAnnouncements = [
  {
    id: 1,
    title: 'Company Holiday',
    content: 'Office will be closed tomorrow for the holiday.',
    createdAt: '2024-01-15T10:30:00Z',
    createdBy: {
      id: 1,
      name: 'John Admin'
    }
  },
  {
    id: 2,
    title: 'Team Meeting',
    content: 'All-hands meeting scheduled for Friday at 2 PM.',
    createdAt: '2024-01-14T14:15:00Z',
    createdBy: {
      id: 1,
      name: 'Jane Manager'
    }
  }
];

describe('AnnouncementsList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toast.error = jest.fn();
    toast.success = jest.fn();
  });

  describe('Rendering for different user roles', () => {
    it('should display announcements for authenticated admin users', async () => {
      // Test Case 1 & 3: Admin can see announcements with management options
      useAuth.mockReturnValue({
        user: { id: 1, role: 'admin', email: 'admin@company.com' }
      });
      
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      // Admin should see edit and delete buttons
      expect(screen.getAllByRole('button')).toHaveLength(4); // 2 edit + 2 delete buttons
      expect(screen.getByText('Office will be closed tomorrow for the holiday.')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15 10:30 AM')).toBeInTheDocument();
    });

    it('should display announcements for authenticated employee users', async () => {
      // Test Case 3: Employee can see announcements but no management options
      useAuth.mockReturnValue({
        user: { id: 2, role: 'employee', email: 'employee@company.com' }
      });
      
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      // Employee should not see edit/delete buttons
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should display announcements for manager users', async () => {
      // Test Case 3: Manager can see announcements
      useAuth.mockReturnValue({
        user: { id: 3, role: 'manager', email: 'manager@company.com' }
      });
      
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      });

      // Manager should not see edit/delete buttons (only admin)
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Admin management functions', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: { id: 1, role: 'admin', email: 'admin@company.com' }
      });
    });

    it('should handle announcement deletion successfully', async () => {
      // Test Case 5: Admin deletes announcement
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);
      announcementService.deleteAnnouncement = jest.fn().mockResolvedValue();

      // Mock window.confirm
      window.confirm = jest.fn().mockReturnValue(true);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
      });

      // Find and click delete button for first announcement
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this announcement?');
      
      await waitFor(() => {
        expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1);
        expect(toast.success).toHaveBeenCalledWith('Announcement deleted successfully');
      });
    });

    it('should cancel deletion when user clicks cancel', async () => {
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);
      announcementService.deleteAnnouncement = jest.fn();

      window.confirm = jest.fn().mockReturnValue(false);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalled();
      expect(announcementService.deleteAnnouncement).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should handle edit button click', async () => {
      const mockOnEdit = jest.fn();
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);

      render(<AnnouncementsList onEdit={mockOnEdit} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      expect(mockOnEdit).toHaveBeenCalledWith(mockAnnouncements[0]);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: { id: 1, role: 'admin', email: 'admin@company.com' }
      });
    });

    it('should handle fetch announcements error', async () => {
      announcementService.getAnnouncements = jest.fn()
        .mockRejectedValue(new Error('Failed to fetch announcements'));

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to fetch announcements');
      });
    });

    it('should handle delete announcement error', async () => {
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);
      announcementService.deleteAnnouncement = jest.fn()
        .mockRejectedValue(new Error('Failed to delete announcement'));

      window.confirm = jest.fn().mockReturnValue(true);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Company Holiday')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete announcement');
      });
    });
  });

  describe('Loading states', () => {
    it('should display loading skeleton while fetching announcements', () => {
      useAuth.mockReturnValue({
        user: { id: 1, role: 'admin', email: 'admin@company.com' }
      });
      
      // Mock a pending promise to simulate loading state
      announcementService.getAnnouncements = jest.fn()
        .mockReturnValue(new Promise(() => {}));

      render(<AnnouncementsList onEdit={jest.fn()} />);

      // Should show loading skeletons
      expect(screen.getAllByText('').length).toBeGreaterThan(0);
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Refresh functionality', () => {
    it('should refetch announcements when refreshTrigger changes', async () => {
      useAuth.mockReturnValue({
        user: { id: 1, role: 'admin', email: 'admin@company.com' }
      });
      
      announcementService.getAnnouncements = jest.fn().mockResolvedValue(mockAnnouncements);

      const { rerender } = render(<AnnouncementsList onEdit={jest.fn()} refreshTrigger={1} />);
      
      expect(announcementService.getAnnouncements).toHaveBeenCalledTimes(1);

      // Change refreshTrigger prop
      rerender(<AnnouncementsList onEdit={jest.fn()} refreshTrigger={2} />);
      
      expect(announcementService.getAnnouncements).toHaveBeenCalledTimes(2);
    });
  });

  describe('Empty state', () => {
    it('should display empty state when no announcements exist', async () => {
      useAuth.mockReturnValue({
        user: { id: 1, role: 'admin', email: 'admin@company.com' }
      });
      
      announcementService.getAnnouncements = jest.fn().mockResolvedValue([]);

      render(<AnnouncementsList onEdit={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/no announcements/i)).toBeInTheDocument();
      });
    });
  });
});