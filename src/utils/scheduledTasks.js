const cron = require('node-cron');
const { Announcement, sequelize } = require('../models');
const { Op } = require('sequelize');

// Distributed lock implementation using database
const LOCK_TIMEOUT = 300000; // 5 minutes in milliseconds
const LOCK_NAME_ARCHIVE = 'archive_expired_announcements';
const LOCK_NAME_CLEANUP = 'cleanup_old_announcements';

/**
 * Acquire a distributed lock using database
 */
const acquireLock = async (lockName, timeoutMs = LOCK_TIMEOUT) => {
  try {
    const lockId = `${lockName}_${Date.now()}`;
    const expireAt = new Date(Date.now() + timeoutMs);
    
    // Try to acquire lock by inserting a record
    await sequelize.query(
      `INSERT INTO locks (name, lock_id, expires_at, created_at) VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       lock_id = IF(expires_at < NOW(), VALUES(lock_id), lock_id),
       expires_at = IF(expires_at < NOW(), VALUES(expires_at), expires_at)`,
      {
        replacements: [lockName, lockId, expireAt, new Date()],
        type: sequelize.QueryTypes.INSERT
      }
    );
    
    // Verify we got the lock
    const [results] = await sequelize.query(
      'SELECT lock_id FROM locks WHERE name = ? AND expires_at > NOW()',
      {
        replacements: [lockName],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    return results && results.lock_id === lockId ? lockId : null;
  } catch (error) {
    console.error(`Error acquiring lock ${lockName}:`, error);
    return null;
  }
};

/**
 * Release a distributed lock
 */
const releaseLock = async (lockName, lockId) => {
  try {
    await sequelize.query(
      'DELETE FROM locks WHERE name = ? AND lock_id = ?',
      {
        replacements: [lockName, lockId],
        type: sequelize.QueryTypes.DELETE
      }
    );
    return true;
  } catch (error) {
    console.error(`Error releasing lock ${lockName}:`, error);
    return false;
  }
};

/**
 * Scheduled task to automatically archive expired announcements
 * Runs every hour to check for announcements past their expiration date
 */
const archiveExpiredAnnouncements = () => {
  cron.schedule('0 * * * *', async () => {
    let lockId = null;
    let transaction = null;
    
    try {
      console.log('Running scheduled task: Archive expired announcements');
      
      // Acquire distributed lock to prevent race conditions
      lockId = await acquireLock(LOCK_NAME_ARCHIVE);
      if (!lockId) {
        console.log('Could not acquire lock for archive task, skipping this run');
        return;
      }
      
      transaction = await sequelize.transaction();
      
      const currentDate = new Date();
      
      // Find all active announcements that have expired with row-level locking
      const expiredAnnouncements = await Announcement.findAll({
        where: {
          status: 'active',
          expiresAt: {
            [Op.lt]: currentDate
          }
        },
        lock: true,
        transaction
      });

      if (expiredAnnouncements.length > 0) {
        // Update expired announcements to archived status within transaction
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
            },
            transaction
          }
        );

        await transaction.commit();
        console.log(`Archived ${expiredAnnouncements.length} expired announcements`);
      } else {
        await transaction.commit();
        console.log('No expired announcements found');
      }
    } catch (error) {
      console.error('Error in archiveExpiredAnnouncements scheduled task:', error);
      
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
    } finally {
      // Always release the lock
      if (lockId) {
        try {
          await releaseLock(LOCK_NAME_ARCHIVE, lockId);
        } catch (lockError) {
          console.error('Error releasing lock:', lockError);
        }
      }
    }
  });
};

/**
 * Scheduled task to clean up old archived announcements
 * Runs daily at 2 AM to remove announcements archived more than 90 days ago
 */
const cleanupOldArchivedAnnouncements = () => {
  cron.schedule('0 2 * * *', async () => {
    let lockId = null;
    let transaction = null;
    
    try {
      console.log('Running scheduled task: Cleanup old archived announcements');
      
      // Acquire distributed lock to prevent race conditions
      lockId = await acquireLock(LOCK_NAME_CLEANUP);
      if (!lockId) {
        console.log('Could not acquire lock for cleanup task, skipping this run');
        return;
      }
      
      transaction = await sequelize.transaction();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
      
      // Delete archived announcements older than 90 days within transaction
      const deletedCount = await Announcement.destroy({
        where: {
          status: 'archived',
          archivedAt: {
            [Op.lt]: cutoffDate
          }
        },
        transaction
      });

      await transaction.commit();
      
      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} old archived announcements`);
      } else {
        console.log('No old archived announcements found for cleanup');
      }
    } catch (error) {
      console.error('Error in cleanupOldArchivedAnnouncements scheduled task:', error);
      
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
    } finally {
      // Always release the lock
      if (lockId) {
        try {
          await releaseLock(LOCK_NAME_CLEANUP, lockId);
        } catch (lockError) {
          console.error('Error releasing lock:', lockError);
        }
      }
    }
  });
};

/**
 * Initialize all scheduled tasks
 */
const initializeScheduledTasks = () => {
  try {
    console.log('Initializing scheduled tasks...');
    
    // Ensure locks table exists
    createLocksTableIfNotExists()
      .then(() => {
        archiveExpiredAnnouncements();
        cleanupOldArchivedAnnouncements();
        console.log('Scheduled tasks initialized successfully');
      })
      .catch(error => {
        console.error('Error initializing scheduled tasks:', error);
      });
  } catch (error) {
    console.error('Error in initializeScheduledTasks:', error);
  }
};

/**
 * Create locks table if it doesn't exist
 */
const createLocksTableIfNotExists = async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS locks (
        name VARCHAR(255) PRIMARY KEY,
        lock_id VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires_at (expires_at)
      )
    `);
  } catch (error) {
    console.error('Error creating locks table:', error);
    throw error;
  }
};

/**
 * Manual function to archive expired announcements (for testing or manual runs)
 */
const manualArchiveExpiredAnnouncements = async () => {
  let transaction = null;
  
  try {
    const currentDate = new Date();
    transaction = await sequelize.transaction();
    
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
        },
        transaction
      }
    );

    await transaction.commit();

    return {
      success: true,
      archivedCount: result[0]
    };
  } catch (error) {
    console.error('Error in manual archive:', error);
    
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
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
  try {
    const tasks = cron.getTasks();
    return {
      totalTasks: tasks.size,
      tasks: Array.from(tasks.values()).map(task => ({
        running: task.running,
        destroyed: task.destroyed
      }))
    };
  } catch (error) {
    console.error('Error getting scheduled task status:', error);
    return {
      totalTasks: 0,
      tasks: [],
      error: error.message
    };
  }
};

module.exports = {
  initializeScheduledTasks,
  archiveExpiredAnnouncements,
  cleanupOldArchivedAnnouncements,
  manualArchiveExpiredAnnouncements,
  getScheduledTaskStatus
};