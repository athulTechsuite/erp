const cron = require('node-cron');
const { Op } = require('sequelize');
const { Announcement } = require('../models');
const logger = require('../utils/logger');

class AnnouncementArchiver {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  /**
   * Start the announcement archiver job
   * Runs daily at 2:00 AM to archive announcements older than 6 months
   */
  start() {
    if (this.job) {
      logger.warn('AnnouncementArchiver job is already running');
      return;
    }

    // Schedule job to run daily at 2:00 AM
    this.job = cron.schedule('0 2 * * *', async () => {
      await this.archiveOldAnnouncements();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('AnnouncementArchiver job started - will run daily at 2:00 AM UTC');
  }

  /**
   * Stop the announcement archiver job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('AnnouncementArchiver job stopped');
    }
  }

  /**
   * Archive announcements older than 6 months
   * Updates the 'archived' status instead of deleting to preserve data
   */
  async archiveOldAnnouncements() {
    if (this.isRunning) {
      logger.warn('AnnouncementArchiver job is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      logger.info('Starting announcement archiving process...');

      // Calculate the cutoff date (6 months ago)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Find announcements older than 6 months that are not already archived
      const announcementsToArchive = await Announcement.findAll({
        where: {
          publishedAt: {
            [Op.lt]: sixMonthsAgo
          },
          archived: false,
          // Only archive published announcements
          status: 'published'
        },
        attributes: ['id', 'title', 'publishedAt']
      });

      if (announcementsToArchive.length === 0) {
        logger.info('No announcements found for archiving');
        return;
      }

      logger.info(`Found ${announcementsToArchive.length} announcements to archive`);

      // Archive the announcements in batches to avoid overwhelming the database
      const batchSize = 100;
      let archivedCount = 0;

      for (let i = 0; i < announcementsToArchive.length; i += batchSize) {
        const batch = announcementsToArchive.slice(i, i + batchSize);
        const batchIds = batch.map(announcement => announcement.id);

        try {
          const [updatedCount] = await Announcement.update(
            {
              archived: true,
              archivedAt: new Date()
            },
            {
              where: {
                id: {
                  [Op.in]: batchIds
                }
              }
            }
          );

          archivedCount += updatedCount;

          logger.debug(`Archived batch of ${updatedCount} announcements (${i + 1}-${Math.min(i + batchSize, announcementsToArchive.length)})`);

          // Small delay between batches to reduce database load
          if (i + batchSize < announcementsToArchive.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (batchError) {
          logger.error(`Error archiving batch ${i / batchSize + 1}:`, batchError);
          // Continue with next batch even if one fails
        }
      }

      const duration = new Date() - startTime;
      logger.info(`Announcement archiving completed. Archived ${archivedCount} announcements in ${duration}ms`);

      // Log some statistics
      const totalAnnouncements = await Announcement.count({
        where: { status: 'published' }
      });
      const archivedAnnouncements = await Announcement.count({
        where: { archived: true }
      });

      logger.info(`Archiving statistics: ${archivedAnnouncements} archived out of ${totalAnnouncements} total published announcements`);

    } catch (error) {
      logger.error('Error during announcement archiving process:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger the archiving process (useful for testing or admin actions)
   */
  async triggerArchiving() {
    logger.info('Manually triggering announcement archiving...');
    await this.archiveOldAnnouncements();
  }

  /**
   * Get statistics about archived announcements
   */
  async getArchivingStats() {
    try {
      const totalCount = await Announcement.count();
      const archivedCount = await Announcement.count({
        where: { archived: true }
      });
      const publishedCount = await Announcement.count({
        where: { status: 'published', archived: false }
      });

      // Get oldest and newest archived announcements
      const oldestArchived = await Announcement.findOne({
        where: { archived: true },
        order: [['archivedAt', 'ASC']],
        attributes: ['archivedAt']
      });

      const newestArchived = await Announcement.findOne({
        where: { archived: true },
        order: [['archivedAt', 'DESC']],
        attributes: ['archivedAt']
      });

      return {
        total: totalCount,
        archived: archivedCount,
        published: publishedCount,
        archivedPercentage: totalCount > 0 ? ((archivedCount / totalCount) * 100).toFixed(2) : 0,
        oldestArchivedAt: oldestArchived?.archivedAt || null,
        newestArchivedAt: newestArchived?.archivedAt || null,
        jobStatus: this.job ? 'running' : 'stopped',
        isProcessing: this.isRunning
      };
    } catch (error) {
      logger.error('Error getting archiving statistics:', error);
      throw error;
    }
  }

  /**
   * Restore archived announcements (admin function)
   */
  async restoreAnnouncements(announcementIds) {
    try {
      const [updatedCount] = await Announcement.update(
        {
          archived: false,
          archivedAt: null
        },
        {
          where: {
            id: {
              [Op.in]: announcementIds
            },
            archived: true
          }
        }
      );

      logger.info(`Restored ${updatedCount} announcements from archive`);
      return updatedCount;
    } catch (error) {
      logger.error('Error restoring announcements:', error);
      throw error;
    }
  }
}

// Create singleton instance
const announcementArchiver = new AnnouncementArchiver();

module.exports = announcementArchiver;