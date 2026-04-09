import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import AnnouncementList from '../../frontend/src/components/Announcements/AnnouncementList';
import AnnouncementForm from '../../frontend/src/components/Announcements/AnnouncementForm';
import { useAuth } from '../../frontend/src/contexts/AuthContext';

// Mock the useAuth hook
jest.mock('../../frontend/src/contexts/AuthContext');

// Mock fetch
global.fetch = jest.fn();

const mockAuthContext = (user, token) => {
  useAuth.mockReturnValue({
    user,
    token,
    isAuthenticated: !!user
  });
};

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('AnnouncementList Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Admin User Tests', () => {
    const adminUser = {
      id: '1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin'
    };
    const token = 'admin-token-123';

    it('should display announcement form for admin users', async () => {
      mockAuthContext(adminUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [] })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('Announcement title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Announcement content')).toBeInTheDocument();
      expect(screen.getByText('Create Announcement')).toBeInTheDocument();
    });

    it('should display announcements list with edit/delete buttons for admin', async () => {
      const mockAnnouncements = [
        {
          id: '1',
          title: 'Test Announcement 1',
          content: 'Test content 1',
          createdAt: new Date().toISOString(),
          author: { name: 'Admin User' }
        },
        {
          id: '2',
          title: 'Test Announcement 2',
          content: 'Test content 2',
          createdAt: new Date().toISOString(),
          author: { name: 'Admin User' }
        }
      ];

      mockAuthContext(adminUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: mockAnnouncements })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
        expect(screen.getByText('Test Announcement 2')).toBeInTheDocument();
      });

      expect(screen.getAllByLabelText(/edit announcement/i)).toHaveLength(2);
      expect(screen.getAllByLabelText(/delete announcement/i)).toHaveLength(2);
    });

    it('should handle announcement creation successfully', async () => {
      const newAnnouncement = {
        id: '3',
        title: 'New Announcement',
        content: 'New content',
        createdAt: new Date().toISOString(),
        author: { name: 'Admin User' }
      };

      mockAuthContext(adminUser, token);
      
      // Mock initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [] })
      });
      
      // Mock create announcement
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, announcement: newAnnouncement })
      });
      
      // Mock refetch after creation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [newAnnouncement] })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      // Fill out the form
      fireEvent.change(screen.getByPlaceholderText('Announcement title'), {
        target: { value: 'New Announcement' }
      });
      fireEvent.change(screen.getByPlaceholderText('Announcement content'), {
        target: { value: 'New content' }
      });

      // Submit the form
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: 'New Announcement',
            content: 'New content'
          })
        });
      });
    });

    it('should handle announcement deletion', async () => {
      const mockAnnouncements = [
        {
          id: '1',
          title: 'Test Announcement',
          content: 'Test content',
          createdAt: new Date().toISOString(),
          author: { name: 'Admin User' }
        }
      ];

      mockAuthContext(adminUser, token);
      
      // Mock initial fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: mockAnnouncements })
      });
      
      // Mock delete
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      // Mock refetch after deletion
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [] })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Test Announcement')).toBeInTheDocument();
      });

      // Click delete button
      fireEvent.click(screen.getByLabelText(/delete announcement/i));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/announcements/1', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      });
    });

    it('should handle form validation errors', async () => {
      mockAuthContext(adminUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [] })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Create New Announcement')).toBeInTheDocument();
      });

      // Try to submit empty form
      fireEvent.click(screen.getByText('Create Announcement'));

      await waitFor(() => {
        expect(screen.getByText('Title and content are required')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockAuthContext(adminUser, token);
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Access denied. Admin role required.' })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Access denied. Admin role required.')).toBeInTheDocument();
      });
    });
  });

  describe('Employee User Tests', () => {
    const employeeUser = {
      id: '2',
      name: 'Employee User',
      email: 'employee@test.com',
      role: 'employee'
    };
    const token = 'employee-token-123';

    it('should not display announcement form for employee users', async () => {
      mockAuthContext(employeeUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [] })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.queryByText('Create New Announcement')).not.toBeInTheDocument();
      });

      expect(screen.queryByPlaceholderText('Announcement title')).not.toBeInTheDocument();
      expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
    });

    it('should display announcements without edit/delete buttons for employees', async () => {
      const mockAnnouncements = [
        {
          id: '1',
          title: 'Company Announcement',
          content: 'Important company update',
          createdAt: new Date().toISOString(),
          author: { name: 'Admin User' }
        }
      ];

      mockAuthContext(employeeUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: mockAnnouncements })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Company Announcement')).toBeInTheDocument();
        expect(screen.getByText('Important company update')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/edit announcement/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/delete announcement/i)).not.toBeInTheDocument();
    });

    it('should display empty state when no announcements exist', async () => {
      mockAuthContext(employeeUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: [] })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('No announcements available')).toBeInTheDocument();
      });
    });

    it('should display announcements ordered by creation date (newest first)', async () => {
      const mockAnnouncements = [
        {
          id: '1',
          title: 'Older Announcement',
          content: 'Older content',
          createdAt: '2023-01-01T00:00:00.000Z',
          author: { name: 'Admin User' }
        },
        {
          id: '2',
          title: 'Newer Announcement',
          content: 'Newer content',
          createdAt: '2023-01-02T00:00:00.000Z',
          author: { name: 'Admin User' }
        }
      ];

      mockAuthContext(employeeUser, token);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: mockAnnouncements })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        const announcements = screen.getAllByRole('article');
        expect(announcements[0]).toHaveTextContent('Newer Announcement');
        expect(announcements[1]).toHaveTextContent('Older Announcement');
      });
    });
  });

  describe('Authentication Tests', () => {
    it('should handle unauthorized access', async () => {
      mockAuthContext(null, null);
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized access' })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized access')).toBeInTheDocument();
      });
    });

    it('should redirect to login when token is invalid', async () => {
      const invalidUser = {
        id: '1',
        name: 'Test User',
        email: 'test@test.com',
        role: 'employee'
      };
      
      mockAuthContext(invalidUser, 'invalid-token');
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid token' })
      });

      renderWithRouter(<AnnouncementList />);

      await waitFor(() => {
        expect(screen.getByText('Invalid token')).toBeInTheDocument();
      });
    });
  });
});

describe('AnnouncementForm Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  const adminUser = {
    id: '1',
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin'
  };
  const token = 'admin-token-123';

  it('should render form fields correctly', () => {
    mockAuthContext(adminUser, token);
    const mockOnCreated = jest.fn();
    
    renderWithRouter(
      <AnnouncementForm onAnnouncementCreated={mockOnCreated} />
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('should handle form submission with valid data', async () => {
    mockAuthContext(adminUser, token);
    const mockOnCreated = jest.fn();
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        announcement: {
          id: '1',
          title: 'Test Title',
          content: 'Test Content'
        }
      })
    });

    renderWithRouter(
      <AnnouncementForm onAnnouncementCreated={mockOnCreated} />
    );

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Title' }
    });
    fireEvent.change(screen.getByLabelText(/content/i), {
      target: { value: 'Test Content' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalled();
    });
  });

  it('should display validation errors for empty fields', () => {
    mockAuthContext(adminUser, token);
    const mockOnCreated = jest.fn();
    
    renderWithRouter(
      <AnnouncementForm onAnnouncementCreated={mockOnCreated} />
    );

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByText('Both title and content are required')).toBeInTheDocument();
  });

  it('should handle edit mode correctly', () => {
    const editingAnnouncement = {
      id: '1',
      title: 'Existing Title',
      content: 'Existing Content'
    };
    
    mockAuthContext(adminUser, token);
    const mockOnEditComplete = jest.fn();
    
    renderWithRouter(
      <AnnouncementForm 
        editingAnnouncement={editingAnnouncement}
        onEditComplete={mockOnEditComplete} 
      />
    );

    expect(screen.getByDisplayValue('Existing Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
  });
});