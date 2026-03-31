import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AnnouncementManagement from '../../frontend/src/components/Announcements/AnnouncementManagement';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(() => 'mock-admin-token'),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock console.error
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('AnnouncementManagement Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('PRD Test Case 1: Admin can see announcements management section', () => {
    test('Given I am logged in as an admin user When I navigate to the announcements management section Then I can see a list of all existing announcements with options to create, edit, and delete them', async () => {
      const mockAnnouncements = [
        {
          id: 1,
          title: 'Existing Announcement',
          message: 'This is an existing announcement',
          created_at: '2024-01-01T10:00:00Z'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementManagement />);

      // Verify loading state and then content
      await waitFor(() => {
        expect(screen.getByText('Existing Announcement')).toBeInTheDocument();
      });

      // Verify CRUD operation buttons are present
      expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit announcement')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete announcement')).toBeInTheDocument();
    });
  });

  describe('PRD Test Case 2: Admin creating new announcement', () => {
    test('Given I am an admin creating a new announcement When I submit a text-only announcement with a title and message Then The announcement is saved to the database and immediately appears on all employee dashboards', async () => {
      const user = userEvent.setup();
      
      // Mock initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });
      
      // Mock create announcement response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Announcement created successfully'
        })
      });
      
      // Mock refetch after creation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 1,
          title: 'New Policy Update',
          message: 'Please review the new company policies',
          created_at: new Date().toISOString()
        }]
      });

      render(<AnnouncementManagement />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      // Click create button
      await user.click(screen.getByText('Create New Announcement'));
      
      // Fill in the form
      const titleInput = screen.getByPlaceholderText('Announcement title');
      const messageInput = screen.getByPlaceholderText('Announcement message');
      
      await user.type(titleInput, 'New Policy Update');
      await user.type(messageInput, 'Please review the new company policies');
      
      // Submit the form
      await user.click(screen.getByText('Create'));
      
      // Verify API was called correctly
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-admin-token',
          },
          body: JSON.stringify({
            title: 'New Policy Update',
            message: 'Please review the new company policies'
          })
        });
      });
    });

    test('Should show validation error when title is missing', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create New Announcement'));
      
      // Only fill message, leave title empty
      const messageInput = screen.getByPlaceholderText('Announcement message');
      await user.type(messageInput, 'Message without title');
      
      await user.click(screen.getByText('Create'));
      
      expect(screen.getByText('Please fill in both title and message')).toBeInTheDocument();
    });

    test('Should show validation error when message is missing', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create New Announcement'));
      
      // Only fill title, leave message empty
      const titleInput = screen.getByPlaceholderText('Announcement title');
      await user.type(titleInput, 'Title without message');
      
      await user.click(screen.getByText('Create'));
      
      expect(screen.getByText('Please fill in both title and message')).toBeInTheDocument();
    });
  });

  describe('PRD Test Case 4: Admin editing existing announcement', () => {
    test('Given I am an admin editing an existing announcement When I update the title or message content Then The changes are saved and immediately reflected on all employee dashboards', async () => {
      const user = userEvent.setup();
      
      const mockAnnouncement = {
        id: 1,
        title: 'Original Title',
        message: 'Original message',
        created_at: '2024-01-01T10:00:00Z'
      };

      // Mock initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockAnnouncement]
      });
      
      // Mock update response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Announcement updated successfully'
        })
      });
      
      // Mock refetch after update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          ...mockAnnouncement,
          title: 'Updated Title',
          message: 'Updated message'
        }]
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Original Title')).toBeInTheDocument();
      });

      // Click edit button
      await user.click(screen.getByLabelText('Edit announcement'));
      
      // Update the fields
      const titleInput = screen.getByDisplayValue('Original Title');
      const messageInput = screen.getByDisplayValue('Original message');
      
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');
      await user.clear(messageInput);
      await user.type(messageInput, 'Updated message');
      
      // Save changes
      await user.click(screen.getByLabelText('Save changes'));
      
      // Verify API was called correctly
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-admin-token',
          },
          body: JSON.stringify({
            title: 'Updated Title',
            message: 'Updated message'
          })
        });
      });
    });
  });

  describe('PRD Test Case 5: Admin deleting announcement', () => {
    test('Given I am an admin deleting an announcement When I confirm the deletion Then The announcement is removed from the database and no longer appears on any dashboards', async () => {
      const user = userEvent.setup();
      
      const mockAnnouncement = {
        id: 1,
        title: 'To Be Deleted',
        message: 'This announcement will be deleted',
        created_at: '2024-01-01T10:00:00Z'
      };

      // Mock initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockAnnouncement]
      });
      
      // Mock delete response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Announcement deleted successfully'
        })
      });
      
      // Mock refetch after deletion (empty array)
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('To Be Deleted')).toBeInTheDocument();
      });

      // Click delete button
      await user.click(screen.getByLabelText('Delete announcement'));
      
      // Verify API was called correctly
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/1', {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer mock-admin-token',
          },
        });
      });
    });
  });

  describe('PRD Test Case 6: Error handling', () => {
    test('Should handle API errors gracefully during fetch', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load announcements. Please try again.')).toBeInTheDocument();
      });
    });

    test('Should handle API errors during creation', async () => {
      const user = userEvent.setup();
      
      // Mock initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });
      
      // Mock failed create
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' })
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create New Announcement'));
      
      const titleInput = screen.getByPlaceholderText('Announcement title');
      const messageInput = screen.getByPlaceholderText('Announcement message');
      
      await user.type(titleInput, 'Test Title');
      await user.type(messageInput, 'Test Message');
      
      await user.click(screen.getByText('Create'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to create announcement. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    test('Should reset form after successful creation', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create New Announcement'));
      
      const titleInput = screen.getByPlaceholderText('Announcement title');
      const messageInput = screen.getByPlaceholderText('Announcement message');
      
      await user.type(titleInput, 'Test Title');
      await user.type(messageInput, 'Test Message');
      
      await user.click(screen.getByText('Create'));
      
      await waitFor(() => {
        expect(screen.queryByDisplayValue('Test Title')).not.toBeInTheDocument();
      });
    });

    test('Should cancel form and hide create form', async () => {
      const user = userEvent.setup();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManagement />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create New Announcement'));
      
      expect(screen.getByPlaceholderText('Announcement title')).toBeInTheDocument();
      
      await user.click(screen.getByLabelText('Cancel'));
      
      expect(screen.queryByPlaceholderText('Announcement title')).not.toBeInTheDocument();
    });
  });
});