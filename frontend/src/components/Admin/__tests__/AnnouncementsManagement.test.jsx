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

  it('should show create form when Add Announcement button is clicked', async () => {
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

  it('should validate required fields when creating announcement', async () => {
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

  it('should create announcement when valid data is provided', async () => {
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

  it('should prevent submission with only title and show validation error', async () => {
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

  it('should prevent submission with only content and show validation error', async () => {
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

  it('should allow editing existing announcements', async () => {
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

  it('should delete announcement when delete button is clicked', async () => {
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

  it('should handle API errors gracefully during create', async () => {
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

  it('should handle API errors during initial load', async () => {
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

  it('should cancel form editing when cancel button is clicked', async () => {
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