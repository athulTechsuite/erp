import { EventEmitter } from 'events';
import { sendEmail } from './emailService';
import { sendPushNotification } from './pushService';
import { logger } from '../utils/logger';

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map();
    this.notificationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Subscribe user to notification types
   * @param {string} userId - User ID
   * @param {Array} types - Notification types to subscribe to
   */
  subscribe(userId, types = ['email', 'push']) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    
    types.forEach(type => {
      this.subscribers.get(userId).add(type);
    });

    logger.info(`User ${userId} subscribed to notifications: ${types.join(', ')}`);
  }

  /**
   * Unsubscribe user from notification types
   * @param {string} userId - User ID
   * @param {Array} types - Notification types to unsubscribe from
   */
  unsubscribe(userId, types) {
    if (!this.subscribers.has(userId)) return;

    const userSubscriptions = this.subscribers.get(userId);
    types.forEach(type => {
      userSubscriptions.delete(type);
    });

    if (userSubscriptions.size === 0) {
      this.subscribers.delete(userId);
    }

    logger.info(`User ${userId} unsubscribed from notifications: ${types.join(', ')}`);
  }

  /**
   * Send announcement notification to users
   * @param {Object} announcement - Announcement object
   * @param {Array} recipients - Array of user objects
   * @param {Object} options - Notification options
   */
  async sendAnnouncementNotification(announcement, recipients, options = {}) {
    const {
      priority = 'normal',
      immediate = false,
      template = 'announcement'
    } = options;

    const notification = {
      id: `announcement_${announcement.id}_${Date.now()}`,
      type: 'announcement',
      priority,
      title: this.getNotificationTitle(announcement, priority),
      message: this.getNotificationMessage(announcement),
      data: {
        announcementId: announcement.id,
        announcementTitle: announcement.title,
        priority,
        createdAt: announcement.createdAt
      },
      recipients,
      template,
      immediate
    };

    if (immediate || priority === 'urgent') {
      await this.processNotificationImmediate(notification);
    } else {
      this.queueNotification(notification);
    }
  }

  /**
   * Queue notification for batch processing
   * @param {Object} notification - Notification object
   */
  queueNotification(notification) {
    this.notificationQueue.push({
      ...notification,
      queuedAt: new Date()
    });

    logger.debug(`Notification queued: ${notification.id}`);
    this.emit('notification:queued', notification);

    // Process queue if not already processing
    if (!this.isProcessing) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Process notification immediately
   * @param {Object} notification - Notification object
   */
  async processNotificationImmediate(notification) {
    try {
      logger.info(`Processing immediate notification: ${notification.id}`);
      await this.sendToRecipients(notification);
      this.emit('notification:sent', notification);
    } catch (error) {
      logger.error(`Failed to send immediate notification ${notification.id}:`, error);
      this.emit('notification:failed', notification, error);
    }
  }

  /**
   * Process queued notifications in batches
   */
  async processQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batchSize = 10;
    
    try {
      while (this.notificationQueue.length > 0) {
        const batch = this.notificationQueue.splice(0, batchSize);
        await Promise.allSettled(
          batch.map(notification => this.processNotificationImmediate(notification))
        );
        
        // Small delay between batches to avoid overwhelming services
        if (this.notificationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send notification to all recipients
   * @param {Object} notification - Notification object
   */
  async sendToRecipients(notification) {
    const { recipients, type, priority } = notification;
    const promises = [];

    for (const recipient of recipients) {
      const userSubscriptions = this.subscribers.get(recipient.id);
      
      if (!userSubscriptions) continue;

      // Email notifications
      if (userSubscriptions.has('email') && recipient.email) {
        promises.push(this.sendEmailNotification(recipient, notification));
      }

      // Push notifications for urgent announcements
      if (userSubscriptions.has('push') && priority === 'urgent') {
        promises.push(this.sendPushNotificationToUser(recipient, notification));
      }

      // In-app notifications (always send if user is subscribed to any type)
      promises.push(this.createInAppNotification(recipient, notification));
    }

    const results = await Promise.allSettled(promises);
    
    // Log failed notifications
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Failed to send notification to recipient:`, result.reason);
      }
    });

    return results;
  }

  /**
   * Send email notification
   * @param {Object} recipient - Recipient user object
   * @param {Object} notification - Notification object
   */
  async sendEmailNotification(recipient, notification) {
    const emailData = {
      to: recipient.email,
      subject: notification.title,
      template: notification.template,
      data: {
        recipientName: recipient.name,
        announcementTitle: notification.data.announcementTitle,
        message: notification.message,
        priority: notification.priority,
        viewUrl: `${process.env.FRONTEND_URL}/announcements/${notification.data.announcementId}`
      }
    };

    return sendEmail(emailData);
  }

  /**
   * Send push notification
   * @param {Object} recipient - Recipient user object
   * @param {Object} notification - Notification object
   */
  async sendPushNotificationToUser(recipient, notification) {
    const pushData = {
      userId: recipient.id,
      title: notification.title,
      body: notification.message,
      data: notification.data,
      badge: 1,
      sound: notification.priority === 'urgent' ? 'urgent.wav' : 'default.wav'
    };

    return sendPushNotification(pushData);
  }

  /**
   * Create in-app notification record
   * @param {Object} recipient - Recipient user object
   * @param {Object} notification - Notification object
   */
  async createInAppNotification(recipient, notification) {
    // This would typically save to database
    const inAppNotification = {
      userId: recipient.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      read: false,
      createdAt: new Date()
    };

    // Emit event for real-time updates
    this.emit('notification:in-app', recipient.id, inAppNotification);

    logger.debug(`In-app notification created for user ${recipient.id}`);
    return inAppNotification;
  }

  /**
   * Generate notification title based on announcement and priority
   * @param {Object} announcement - Announcement object
   * @param {string} priority - Priority level
   */
  getNotificationTitle(announcement, priority) {
    const priorityPrefix = {
      urgent: '🚨 URGENT: ',
      important: '⚠️ IMPORTANT: ',
      normal: '📢 '
    };

    return `${priorityPrefix[priority] || priorityPrefix.normal}${announcement.title}`;
  }

  /**
   * Generate notification message from announcement
   * @param {Object} announcement - Announcement object
   */
  getNotificationMessage(announcement) {
    const maxLength = 150;
    const content = announcement.content.replace(/<[^>]*>/g, ''); // Strip HTML tags
    
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Send notification for announcement updates
   * @param {Object} announcement - Updated announcement
   * @param {Array} recipients - Array of users who have read the original
   */
  async sendAnnouncementUpdateNotification(announcement, recipients) {
    await this.sendAnnouncementNotification(announcement, recipients, {
      priority: announcement.priority,
      immediate: announcement.priority === 'urgent',
      template: 'announcement_update'
    });
  }

  /**
   * Send digest notification for multiple announcements
   * @param {Array} announcements - Array of announcements
   * @param {Array} recipients - Array of recipient users
   */
  async sendAnnouncementDigest(announcements, recipients) {
    if (announcements.length === 0) return;

    const notification = {
      id: `digest_${Date.now()}`,
      type: 'announcement_digest',
      priority: 'normal',
      title: `📰 Company Updates - ${announcements.length} new announcement${announcements.length > 1 ? 's' : ''}`,
      message: `You have ${announcements.length} new company announcement${announcements.length > 1 ? 's' : ''} to read.`,
      data: {
        announcementIds: announcements.map(a => a.id),
        count: announcements.length
      },
      recipients,
      template: 'announcement_digest',
      immediate: false
    };

    this.queueNotification(notification);
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      subscribersCount: this.subscribers.size,
      queuedNotifications: this.notificationQueue.length,
      isProcessing: this.isProcessing,
      subscribers: Array.from(this.subscribers.entries()).reduce((acc, [userId, types]) => {
        acc[userId] = Array.from(types);
        return acc;
      }, {})
    };
  }

  /**
   * Clear notification queue (for testing/maintenance)
   */
  clearQueue() {
    const clearedCount = this.notificationQueue.length;
    this.notificationQueue = [];
    logger.info(`Cleared ${clearedCount} notifications from queue`);
    return clearedCount;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Start processing queue periodically
setInterval(() => {
  notificationService.processQueue();
}, 30000); // Process every 30 seconds

export default notificationService;

export {
  NotificationService
};