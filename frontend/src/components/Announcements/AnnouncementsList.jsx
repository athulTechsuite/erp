import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, message, Spin, Empty, Typography, Image, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

import { useAuth } from '../../hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import './AnnouncementsList.css';

const { Title, Paragraph } = Typography;
const { confirm } = Modal;

const AnnouncementsList = ({ showCreateButton = true, maxHeight = null }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const { user, token } = useAuth();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/announcements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      message.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (announcementData) => {
    try {
      const formData = new FormData();
      formData.append('title', announcementData.title);
      formData.append('content', announcementData.content);
      if (announcementData.image) {
        formData.append('image', announcementData.image);
      }

      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create announcement');
      }

      message.success('Announcement created successfully');
      setCreateModalVisible(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      message.error(error.message || 'Failed to create announcement');
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    try {
      setDeleteLoading(announcementId);
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete announcement');
      }

      message.success('Announcement deleted successfully');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      message.error(error.message || 'Failed to delete announcement');
    } finally {
      setDeleteLoading(null);
    }
  };

  const showDeleteConfirm = (announcement) => {
    confirm({
      title: 'Delete Announcement',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        handleDeleteAnnouncement(announcement.id);
      },
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="announcements-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="announcements-list">
      {showCreateButton && isAdmin && (
        <div className="announcements-header">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
            className="create-announcement-btn"
          >
            Create Announcement
          </Button>
        </div>
      )}

      <div 
        className="announcements-container"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : {}}
      >
        {announcements.length === 0 ? (
          <Empty
            description="No announcements available"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div className="announcements-grid">
            {announcements.map((announcement) => (
              <Card
                key={announcement.id}
                className="announcement-card"
                actions={isAdmin ? [
                  <Popconfirm
                    title="Delete Announcement"
                    description="Are you sure you want to delete this announcement?"
                    onConfirm={() => handleDeleteAnnouncement(announcement.id)}
                    okText="Yes"
                    cancelText="No"
                    okType="danger"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteLoading === announcement.id}
                      className="delete-btn"
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                ] : undefined}
              >
                <div className="announcement-content">
                  <Title level={4} className="announcement-title">
                    {announcement.title}
                  </Title>
                  
                  {announcement.image_url && (
                    <div className="announcement-image">
                      <Image
                        src={announcement.image_url}
                        alt="Announcement"
                        style={{ maxWidth: '100%', maxHeight: '200px' }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FmuFE4SDBSsQIhLBjOAFvgBvgBMQN2A1wA9wAJ2AJ3kkg2zHC2IlJoCRIhEUiRzpFz7xiu3p6urv+dL9635+0M9Pvdn2dVvWj97961a/pNX+/9a+XeCdASBGEhCIgBAnOCXkgCAlCQpDgnBAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQECc4JeSAICUJCkOCckAeCkCAkBAnOCXkgCAlCQpDgnJAHgpAgJAQJzgl5IAgJQkKQ4JyQB4KQICQ0Fz8BHpFdZlz4ZI8AAAAASUVORK5CYII="
                      />
                    </div>
                  )}

                  <Paragraph className="announcement-text">
                    {announcement.content}
                  </Paragraph>

                  <div className="announcement-meta">
                    <span className="announcement-date">
                      {formatDate(announcement.created_at)}
                    </span>
                    <span className="announcement-author">
                      By: {announcement.created_by_name}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        title="Create New Announcement"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <AnnouncementForm
          onSubmit={handleCreateAnnouncement}
          onCancel={() => setCreateModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default AnnouncementsList;