import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Edit2, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import { toast } from 'react-hot-toast';
import { announcementService } from '../../services/announcementService';

const AnnouncementList = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;
  const { user } = useAuth();
  const operationLockRef = useRef(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, [currentPage]);

  const fetchAnnouncements = async (page = currentPage) => {
    try {
      const data = await announcementService.getAll({
        page,
        limit: itemsPerPage,
        sort: 'created_at',
        order: 'desc'
      });
      
      setAnnouncements(data.announcements || data);
      setTotalItems(data.total || data.length);
      setTotalPages(Math.ceil((data.total || data.length) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAnnouncement(null);
    setShowForm(true);
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    // Check for ongoing operation
    if (operationLockRef.current) {
      toast.error('Please wait for the current operation to complete');
      return;
    }

    try {
      operationLockRef.current = true;
      
      // Optimistic update
      const originalAnnouncements = [...announcements];
      setAnnouncements(announcements.filter(a => a.id !== id));
      
      await announcementService.delete(id);
      
      // Update total items and check if we need to adjust current page
      const newTotalItems = totalItems - 1;
      setTotalItems(newTotalItems);
      
      const newTotalPages = Math.ceil(newTotalItems / itemsPerPage);
      setTotalPages(newTotalPages);
      
      // If current page is now empty and not the first page, go to previous page
      if (currentPage > 1 && announcements.length === 1) {
        setCurrentPage(currentPage - 1);
      } else {
        // Refresh current page to ensure consistency
        await fetchAnnouncements(currentPage);
      }
      
      toast.success('Announcement deleted successfully');
    } catch (error) {
      // Revert optimistic update on error
      setAnnouncements(announcements);
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    } finally {
      operationLockRef.current = false;
    }
  };

  const handleFormSubmit = async (formData) => {
    // Check for ongoing operation
    if (operationLockRef.current) {
      toast.error('Please wait for the current operation to complete');
      return;
    }

    try {
      operationLockRef.current = true;
      let savedAnnouncement;
      
      if (editingAnnouncement) {
        // Optimistic update for edit
        const originalAnnouncements = [...announcements];
        const optimisticAnnouncement = { ...editingAnnouncement, ...formData };
        setAnnouncements(announcements.map(a => 
          a.id === editingAnnouncement.id ? optimisticAnnouncement : a
        ));
        
        try {
          savedAnnouncement = await announcementService.update(editingAnnouncement.id, formData);
          // Update with actual server response
          setAnnouncements(announcements.map(a => 
            a.id === editingAnnouncement.id ? savedAnnouncement : a
          ));
          toast.success('Announcement updated successfully');
        } catch (error) {
          // Revert optimistic update on error
          setAnnouncements(originalAnnouncements);
          throw error;
        }
      } else {
        savedAnnouncement = await announcementService.create(formData);
        
        // For new announcements, refresh the first page to show the new item
        setCurrentPage(1);
        await fetchAnnouncements(1);
        
        toast.success('Announcement created successfully');
      }
      
      setShowForm(false);
      setEditingAnnouncement(null);
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast.error('Failed to save announcement');
    } finally {
      operationLockRef.current = false;
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      setLoading(true);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button for Admins */}
      {isAdmin && (
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Company Announcements
            {totalItems > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({totalItems} total)
              </span>
            )}
          </h2>
          <Button
            onClick={handleCreate}
            disabled={operationLockRef.current}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Announcement
          </Button>
        </div>
      )}

      {/* Announcement Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <AnnouncementForm
              announcement={editingAnnouncement}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          </div>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 text-lg">No announcements at this time.</p>
            {isAdmin && (
              <p className="text-gray-400 mt-2">
                Click "Add Announcement" to create the first announcement.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {announcement.title}
                      </h3>
                      <div className="text-sm text-gray-500">
                        <span>By {announcement.author_name || 'Administrator'}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(announcement.created_at)}</span>
                        {announcement.updated_at !== announcement.created_at && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="italic">Updated {formatDate(announcement.updated_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(announcement)}
                          disabled={operationLockRef.current}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(announcement.id)}
                          disabled={operationLockRef.current}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Next
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                    {' '} to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, totalItems)}
                    </span>
                    {' '} of{' '}
                    <span className="font-medium">{totalItems}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="outline"
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </Button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      const shouldShow = 
                        page === 1 || 
                        page === totalPages || 
                        (page >= currentPage - 1 && page <= currentPage + 1);
                      
                      if (!shouldShow) {
                        // Show ellipsis for gaps
                        if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <span key={page} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                              ...
                            </span>
                          );
                        }
                        return null;
                      }
                      
                      return (
                        <Button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          variant={currentPage === page ? "default" : "outline"}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                            currentPage === page
                              ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                          }`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnnouncementList;