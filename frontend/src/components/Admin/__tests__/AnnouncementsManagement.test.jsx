import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnouncementsManagement from '../AnnouncementsManagement';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'admin-token')
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('AnnouncementsManagement', () => {
  beforeEach(() => {
    fetch.mockClear();
    mockLocalStorage.getItem.mockClear();
  });

  const mockAnnouncements = [
    {
      id: 1,
      title: 'Company Policy Update',
      content: 'Updated company policies effective immediately.',
      is_published: true,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Draft Announcement',
      content: 'This is a draft announcement.',
      is_published: false,
      created_at: '2024-01-14T09:00:00Z',
      updated_at: '2024-01-14T09:00:00Z'
    }
  ];

  // TC-001: Announcement CRUD operations - Read/Fetch announcements (Happy Path)
  describe('TC-001: Announcement CRUD Operations - Read', () => {
    it('should load and display existing announcements for admin', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
        expect(screen.getByText('Draft Announcement')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/admin/announcements', {
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle API errors during initial load (Error Path)', async () => {
      fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load announcements. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show published/draft status correctly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Published')).toBeInTheDocument();
        expect(screen.getByText('Draft')).toBeInTheDocument();
      });
    });
  });

  // TC-001: Announcement CRUD operations - Create announcements
  describe('TC-001: Announcement CRUD Operations - Create', () => {
    it('should show create form when Add Announcement button is clicked (Happy Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add New Announcement'));

      expect(screen.getByTestId('create-announcement-form')).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Content')).toBeInTheDocument();
      expect(screen.getByLabelText('Published')).toBeInTheDocument();
    });

    it('should create announcement when valid data is provided (Happy Path)', async () => {
      // Mock initial load
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      // Mock create announcement
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 3,
          title: 'New Announcement',
          content: 'New announcement content',
          is_published: true,
          created_at: new Date().toISOString()
        })
      });

      // Mock refresh after create
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 3,
          title: 'New Announcement',
          content: 'New announcement content',
          is_published: true,
          created_at: new Date().toISOString()
        }]
      });

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Open create form
      fireEvent.click(screen.getByText('Add New Announcement'));

      // Fill form
      await user.type(screen.getByLabelText('Title'), 'New Announcement');
      await user.type(screen.getByLabelText('Content'), 'New announcement content');
      fireEvent.click(screen.getByLabelText('Published'));

      // Submit form
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/announcements', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer admin-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'New Announcement',
            content: 'New announcement content',
            isPublished: true
          })
        });
      });
    });

    it('should validate required fields when creating announcement (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Open create form
      fireEvent.click(screen.getByText('Add New Announcement'));

      // Try to submit without required fields
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Content is required')).toBeInTheDocument();
      });
    });

    it('should prevent submission with only title and show validation error (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add New Announcement'));

      // Only fill title
      await user.type(screen.getByLabelText('Title'), 'Only Title');
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(screen.getByText('Content is required')).toBeInTheDocument();
      });

      // Ensure form is not submitted
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial load
    });

    it('should prevent submission with only content and show validation error (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add New Announcement'));

      // Only fill content
      await user.type(screen.getByLabelText('Content'), 'Only content provided');
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledTimes(1); // Only initial load
    });

    it('should handle API errors gracefully during create (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      // Mock failed create
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add New Announcement'));

      await user.type(screen.getByLabelText('Title'), 'Test Title');
      await user.type(screen.getByLabelText('Content'), 'Test content');
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to create announcement/)).toBeInTheDocument();
      });
    });

    it('should cancel form editing when cancel button is clicked (Happy Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Open create form
      fireEvent.click(screen.getByText('Add New Announcement'));
      expect(screen.getByTestId('create-announcement-form')).toBeInTheDocument();

      // Cancel form
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByTestId('create-announcement-form')).not.toBeInTheDocument();
    });
  });

  // TC-001: Announcement CRUD operations - Update announcements
  describe('TC-001: Announcement CRUD Operations - Update', () => {
    it('should allow editing existing announcements (Happy Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click edit button for first announcement
      const editButtons = screen.getAllByTestId('edit-announcement');
      fireEvent.click(editButtons[0]);

      // Check that edit form is shown with existing data
      expect(screen.getByDisplayValue('Company Policy Update')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Updated company policies effective immediately.')).toBeInTheDocument();
    });

    it('should successfully update announcement with valid data (Happy Path)', async () => {
      // Mock initial load
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      // Mock update announcement
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          title: 'Updated Policy Title',
          content: 'Updated content for policy',
          is_published: true,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: new Date().toISOString()
        })
      });

      // Mock refresh after update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          ...mockAnnouncements[0],
          title: 'Updated Policy Title',
          content: 'Updated content for policy'
        }, mockAnnouncements[1]]
      });

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click edit button
      const editButtons = screen.getAllByTestId('edit-announcement');
      fireEvent.click(editButtons[0]);

      // Clear and update title
      const titleInput = screen.getByDisplayValue('Company Policy Update');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Policy Title');

      // Clear and update content
      const contentInput = screen.getByDisplayValue('Updated company policies effective immediately.');
      await user.clear(contentInput);
      await user.type(contentInput, 'Updated content for policy');

      // Submit update
      fireEvent.click(screen.getByText('Update Announcement'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/announcements/1', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer admin-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Updated Policy Title',
            content: 'Updated content for policy',
            isPublished: true
          })
        });
      });
    });

    it('should handle update API errors gracefully (Error Path)', async () => {
      // Mock initial load
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      // Mock failed update
      fetch.mockRejectedValueOnce(new Error('Update failed'));

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click edit button
      const editButtons = screen.getAllByTestId('edit-announcement');
      fireEvent.click(editButtons[0]);

      // Update title
      const titleInput = screen.getByDisplayValue('Company Policy Update');
      await user.clear(titleInput);
      await user.type(titleInput, 'Failed Update Title');

      // Submit update
      fireEvent.click(screen.getByText('Update Announcement'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to update announcement/)).toBeInTheDocument();
      });
    });

    it('should validate required fields during update (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      const user = userEvent.setup();
      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click edit button
      const editButtons = screen.getAllByTestId('edit-announcement');
      fireEvent.click(editButtons[0]);

      // Clear title to make it invalid
      const titleInput = screen.getByDisplayValue('Company Policy Update');
      await user.clear(titleInput);

      // Try to submit
      fireEvent.click(screen.getByText('Update Announcement'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Ensure API is not called with invalid data
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial load
    });
  });

  // TC-001: Announcement CRUD operations - Delete announcements
  describe('TC-001: Announcement CRUD Operations - Delete', () => {
    it('should delete announcement when delete button is clicked (Happy Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      // Mock delete API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Announcement deleted successfully' })
      });

      // Mock refresh after delete
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockAnnouncements[1]] // Only second announcement remains
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByTestId('delete-announcement');
      fireEvent.click(deleteButtons[0]);

      // Confirm deletion
      fireEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/announcements/1', {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer admin-token',
            'Content-Type': 'application/json'
          }
        });
      });
    });

    it('should handle delete API errors gracefully (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      // Mock failed delete
      fetch.mockRejectedValueOnce(new Error('Delete failed'));

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByTestId('delete-announcement');
      fireEvent.click(deleteButtons[0]);

      // Confirm deletion
      fireEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete announcement/)).toBeInTheDocument();
      });
    });

    it('should cancel delete when cancel button is clicked (Happy Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByTestId('delete-announcement');
      fireEvent.click(deleteButtons[0]);

      // Cancel deletion
      fireEvent.click(screen.getByText('Cancel'));

      // Verify announcement is still present and no delete API call was made
      expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial load
    });

    it('should handle server error response during delete (Error Path)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      // Mock server error response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      render(<AnnouncementsManagement />);

      await waitFor(() => {
        expect(screen.getByText('Company Policy Update')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByTestId('delete-announcement');
      fireEvent.click(deleteButtons[0]);

      // Confirm deletion
      fireEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete announcement/)).toBeInTheDocument();
      });
    });
  });
});