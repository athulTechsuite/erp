const cron = require('node-cron');
const { Announcement } = require('../models');
const { Op } = require('sequelize');

/**
 * Scheduled task to automatically archive expired announcements
 * Runs every hour to check for announcements past their expiration date
 */
const archiveExpiredAnnouncements = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Running scheduled task: Archive expired announcements');
      
      const currentDate = new Date();
      
      // Find all active announcements that have expired
      const expiredAnnouncements = await Announcement.findAll({
        where: {
          status: 'active',
          expiresAt: {
            [Op.lt]: currentDate
          }
        }
      });

      if (expiredAnnouncements.length > 0) {
        // Update expired announcements to archived status
        await Announcement.update(
          { 
            status: 'archived',
            archivedAt: currentDate
          },
          {
            where: {
              status: 'active',
              expiresAt: {
                [Op.lt]: currentDate
              }
            }
          }
        );

        console.log(`Archived ${expiredAnnouncements.length} expired announcements`);
      } else {
        console.log('No expired announcements found');
      }
    } catch (error) {
      console.error('Error in archiveExpiredAnnouncements scheduled task:', error);
    }
  });
};

/**
 * Scheduled task to clean up old archived announcements
 * Runs daily at 2 AM to remove announcements archived more than 90 days ago
 */
const cleanupOldArchivedAnnouncements = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('Running scheduled task: Cleanup old archived announcements');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
      
      // Delete archived announcements older than 90 days
      const deletedCount = await Announcement.destroy({
        where: {
          status: 'archived',
          archivedAt: {
            [Op.lt]: cutoffDate
          }
        }
      });

      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} old archived announcements`);
      } else {
        console.log('No old archived announcements found for cleanup');
      }
    } catch (error) {
      console.error('Error in cleanupOldArchivedAnnouncements scheduled task:', error);
    }
  });
};

/**
 * Initialize all scheduled tasks
 */
const initializeScheduledTasks = () => {
  console.log('Initializing scheduled tasks...');
  
  archiveExpiredAnnouncements();
  cleanupOldArchivedAnnouncements();
  
  console.log('Scheduled tasks initialized successfully');
};

/**
 * Manual function to archive expired announcements (for testing or manual runs)
 */
const manualArchiveExpiredAnnouncements = async () => {
  try {
    const currentDate = new Date();
    
    const result = await Announcement.update(
      { 
        status: 'archived',
        archivedAt: currentDate
      },
      {
        where: {
          status: 'active',
          expiresAt: {
            [Op.lt]: currentDate
          }
        }
      }
    );

    return {
      success: true,
      archivedCount: result[0]
    };
  } catch (error) {
    console.error('Error in manual archive:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get scheduled task status and next run times
 */
const getScheduledTaskStatus = () => {
  const tasks = cron.getTasks();
  return {
    totalTasks: tasks.size,
    tasks: Array.from(tasks.values()).map(task => ({
      running: task.running,
      destroyed: task.destroyed
    }))
  };
};

module.exports = {
  initializeScheduledTasks,
  archiveExpiredAnnouncements,
  cleanupOldArchivedAnnouncements,
  manualArchiveExpiredAnnouncements,
  getScheduledTaskStatus
};