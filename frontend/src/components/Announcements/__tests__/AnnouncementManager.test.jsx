import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnnouncementManager from '../AnnouncementManager';
import { toast } from 'react-toastify';

// Mock dependencies
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock_token'),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('AnnouncementManager Component Tests', () => {
  const mockAnnouncements = [
    {
      id: 1,
      title: 'Test Announcement 1',
      content: 'Test content 1',
      is_active: true,
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Test Announcement 2', 
      content: 'Test content 2',
      is_active: false,
      created_at: '2024-01-14T10:00:00Z'
    }
  ];

  beforeEach(() => {
    fetch.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    mockLocalStorage.getItem.mockReturnValue('mock_token');
  });

  // TC-002: AnnouncementManager component - Happy Path Testing
  describe('TC-002: AnnouncementManager component - Happy Path', () => {
    test('should render AnnouncementManager component with all required elements', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText(/Announcement Management/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Content/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Announcement/i })).toBeInTheDocument();
    });

    test('should successfully create announcement with valid data', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 3,
            title: 'New Announcement',
            content: 'New announcement content',
            is_active: true
          })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/Title/i);
      const contentInput = screen.getByLabelText(/Content/i);
      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });

      fireEvent.change(titleInput, { target: { value: 'New Announcement' } });
      fireEvent.change(contentInput, { target: { value: 'New announcement content' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'New Announcement',
            content: 'New announcement content',
            isActive: true
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Announcement created successfully');
    });

    test('should successfully load and display existing announcements', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
        expect(screen.getByText('Test Announcement 2')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/announcements/admin', {
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json'
        }
      });
    });

    test('should successfully update existing announcement', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockAnnouncements[0],
            title: 'Updated Title',
            content: 'Updated content'
          })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
      fireEvent.click(editButton);

      const titleInput = screen.getByDisplayValue('Test Announcement 1');
      const contentInput = screen.getByDisplayValue('Test content 1');
      
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      fireEvent.change(contentInput, { target: { value: 'Updated content' } });
      
      const updateButton = screen.getByRole('button', { name: /Update Announcement/i });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/1', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer mock_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Updated Title',
            content: 'Updated content',
            isActive: true
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Announcement updated successfully');
    });
  });

  // TC-002: AnnouncementManager component - Error Path Testing
  describe('TC-002: AnnouncementManager component - Error Path', () => {
    test('should handle validation error when required fields are missing', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Announcement/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });
      fireEvent.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Title and content are required');
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial fetch
    });

    test('should handle network error when loading announcements', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error loading announcements'));
      });
    });

    test('should handle server error when creating announcement', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/Title/i);
      const contentInput = screen.getByLabelText(/Content/i);
      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });

      fireEvent.change(titleInput, { target: { value: 'Test Title' } });
      fireEvent.change(contentInput, { target: { value: 'Test content' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error creating announcement'));
      });
    });

    test('should handle access denied error for non-admin users', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Access denied' })
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Access denied. Admin privileges required.');
      });
    });

    test('should handle error when updating announcement fails', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Update failed' })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
      fireEvent.click(editButton);

      const titleInput = screen.getByDisplayValue('Test Announcement 1');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      
      const updateButton = screen.getByRole('button', { name: /Update Announcement/i });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error updating announcement'));
      });
    });

    test('should handle error when deleting announcement fails', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Delete failed' })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /Delete/i })[0];
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error deleting announcement'));
      });
      
      confirmSpy.mockRestore();
    });
  });

  describe('PRD Test Case 1: Admin user navigates to announcements management', () => {
    test('should display announcement management form for admin user', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText(/Announcement Management/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Content/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Announcement/i })).toBeInTheDocument();
    });

    test('should fetch and display existing announcements', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
        expect(screen.getByText('Test Announcement 2')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/announcements/admin', {
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json'
        }
      });
    });
  });

  describe('PRD Test Case 2: Admin creates and publishes new announcement', () => {
    test('should create announcement when form is submitted with valid data', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 3,
            title: 'New Announcement',
            content: 'New announcement content',
            is_active: true
          })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/Title/i);
      const contentInput = screen.getByLabelText(/Content/i);
      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });

      fireEvent.change(titleInput, { target: { value: 'New Announcement' } });
      fireEvent.change(contentInput, { target: { value: 'New announcement content' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'New Announcement',
            content: 'New announcement content',
            isActive: true
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Announcement created successfully');
    });

    test('should validate required fields before submission', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Announcement/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });
      fireEvent.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Title and content are required');
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial fetch
    });
  });

  describe('PRD Test Case 4: Non-admin user access restrictions', () => {
    test('should show access denied message when user lacks admin privileges', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Access denied' })
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Access denied. Admin privileges required.');
      });
    });
  });

  describe('PRD Test Case 5: Admin edits and deletes announcements', () => {
    test('should allow editing existing announcement', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockAnnouncements[0],
            title: 'Updated Title',
            content: 'Updated content'
          })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
      fireEvent.click(editButton);

      const titleInput = screen.getByDisplayValue('Test Announcement 1');
      const contentInput = screen.getByDisplayValue('Test content 1');
      
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      fireEvent.change(contentInput, { target: { value: 'Updated content' } });
      
      const updateButton = screen.getByRole('button', { name: /Update Announcement/i });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/1', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer mock_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Updated Title',
            content: 'Updated content',
            isActive: true
          })
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Announcement updated successfully');
    });

    test('should allow deleting announcement with confirmation', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnnouncements
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /Delete/i })[0];
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this announcement?');
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/1', {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer mock_token',
            'Content-Type': 'application/json'
          }
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Announcement deleted successfully');
      
      confirmSpy.mockRestore();
    });

    test('should not delete announcement when user cancels', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnnouncements
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /Delete/i })[0];
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial fetch
      
      confirmSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error loading announcements'));
      });
    });

    test('should handle server errors when creating announcement', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/Title/i);
      const contentInput = screen.getByLabelText(/Content/i);
      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });

      fireEvent.change(titleInput, { target: { value: 'Test Title' } });
      fireEvent.change(contentInput, { target: { value: 'Test content' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error creating announcement'));
      });
    });
  });

  describe('Form State Management', () => {
    test('should reset form after successful creation', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, title: 'New', content: 'Content' })
        });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/Title/i);
      const contentInput = screen.getByLabelText(/Content/i);

      fireEvent.change(titleInput, { target: { value: 'Test Title' } });
      fireEvent.change(contentInput, { target: { value: 'Test content' } });
      
      const submitButton = screen.getByRole('button', { name: /Create Announcement/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(titleInput.value).toBe('');
        expect(contentInput.value).toBe('');
      });
    });

    test('should toggle form visibility', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<AnnouncementManager />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /New Announcement/i })).toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /New Announcement/i });
      fireEvent.click(newButton);

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByLabelText(/Title/i)).not.toBeInTheDocument();
    });
  });
});