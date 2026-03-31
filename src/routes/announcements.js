const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Get all active announcements (accessible by all authenticated users)
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        title,
        content,
        created_at,
        created_by,
        u.first_name,
        u.last_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      WHERE a.is_active = true
      ORDER BY a.created_at DESC
    `;
    
    const result = await db.query(query);
    
    const announcements = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      createdBy: {
        id: row.created_by,
        name: `${row.first_name} ${row.last_name}`
      }
    }));
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    logger.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Get all announcements for admin management (admin only)
router.get('/manage', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        title,
        content,
        created_at,
        created_by,
        is_active,
        u.first_name,
        u.last_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `;
    
    const result = await db.query(query);
    
    const announcements = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      isActive: row.is_active,
      createdBy: {
        id: row.created_by,
        name: `${row.first_name} ${row.last_name}`
      }
    }));
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    logger.error('Error fetching announcements for management:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Create new announcement (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, content } = req.body;
  
  // Validation
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: 'Title and content are required'
    });
  }
  
  if (title.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'Title must be 255 characters or less'
    });
  }
  
  try {
    // Create announcement in database
    const insertQuery = `
      INSERT INTO announcements (title, content, created_by, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, title, content, created_at, created_by
    `;
    
    const result = await db.query(insertQuery, [title, content, req.user.id]);
    const newAnnouncement = result.rows[0];
    
    // Get all active employees for email notification
    const employeesQuery = `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE is_active = true AND email IS NOT NULL
    `;
    
    const employeesResult = await db.query(employeesQuery);
    const employees = employeesResult.rows;
    
    // Send email notifications to all active employees
    const emailPromises = employees.map(employee => {
      const emailData = {
        to: employee.email,
        subject: `Company Announcement: ${title}`,
        text: `
Dear ${employee.first_name},

We have a new company announcement:

Title: ${title}

${content}

This announcement is also available on your dashboard when you log into the ERP system.

Best regards,
Company Management Team
        `.trim()
      };
      
      return emailService.sendEmail(emailData).catch(error => {
        logger.error(`Failed to send announcement email to ${employee.email}:`, error);
        return { error: true, email: employee.email, message: error.message };
      });
    });
    
    // Wait for all email attempts to complete
    const emailResults = await Promise.allSettled(emailPromises);
    
    // Check for email failures
    const emailFailures = emailResults
      .filter(result => result.status === 'rejected' || (result.value && result.value.error))
      .map(result => result.value || result.reason);
    
    if (emailFailures.length > 0) {
      logger.warn('Some announcement emails failed to send:', {
        announcementId: newAnnouncement.id,
        failures: emailFailures
      });
    }
    
    // Get creator info for response
    const creatorQuery = `
      SELECT first_name, last_name
      FROM users
      WHERE id = $1
    `;
    
    const creatorResult = await db.query(creatorQuery, [req.user.id]);
    const creator = creatorResult.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        id: newAnnouncement.id,
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        createdAt: newAnnouncement.created_at,
        createdBy: {
          id: newAnnouncement.created_by,
          name: `${creator.first_name} ${creator.last_name}`
        }
      },
      emailStatus: {
        totalRecipients: employees.length,
        failedDeliveries: emailFailures.length,
        hasFailures: emailFailures.length > 0
      }
    });
    
  } catch (error) {
    logger.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
});

// Update announcement (admin only)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  
  // Validation
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: 'Title and content are required'
    });
  }
  
  if (title.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'Title must be 255 characters or less'
    });
  }
  
  try {
    // Check if announcement exists
    const existsQuery = 'SELECT id FROM announcements WHERE id = $1';
    const existsResult = await db.query(existsQuery, [id]);
    
    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    // Update announcement
    const updateQuery = `
      UPDATE announcements
      SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, title, content, created_at, updated_at, created_by
    `;
    
    const result = await db.query(updateQuery, [title, content, id]);
    const updatedAnnouncement = result.rows[0];
    
    // Get creator info for response
    const creatorQuery = `
      SELECT first_name, last_name
      FROM users
      WHERE id = $1
    `;
    
    const creatorResult = await db.query(creatorQuery, [updatedAnnouncement.created_by]);
    const creator = creatorResult.rows[0];
    
    res.json({
      success: true,
      data: {
        id: updatedAnnouncement.id,
        title: updatedAnnouncement.title,
        content: updatedAnnouncement.content,
        createdAt: updatedAnnouncement.created_at,
        updatedAt: updatedAnnouncement.updated_at,
        createdBy: {
          id: updatedAnnouncement.created_by,
          name: `${creator.first_name} ${creator.last_name}`
        }
      }
    });
    
  } catch (error) {
    logger.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement'
    });
  }
});

// Delete announcement (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if announcement exists
    const existsQuery = 'SELECT id, title FROM announcements WHERE id = $1';
    const existsResult = await db.query(existsQuery, [id]);
    
    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    const announcement = existsResult.rows[0];
    
    // Delete announcement (hard delete)
    const deleteQuery = 'DELETE FROM announcements WHERE id = $1';
    await db.query(deleteQuery, [id]);
    
    logger.info('Announcement deleted:', {
      id: id,
      title: announcement.title,
      deletedBy: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
    
  } catch (error) {
    logger.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement'
    });
  }
});

// Toggle announcement active status (admin only)
router.patch('/:id/toggle', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if announcement exists and get current status
    const existsQuery = 'SELECT id, is_active FROM announcements WHERE id = $1';
    const existsResult = await db.query(existsQuery, [id]);
    
    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    const currentStatus = existsResult.rows[0].is_active;
    const newStatus = !currentStatus;
    
    // Update status
    const updateQuery = `
      UPDATE announcements
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, title, is_active
    `;
    
    const result = await db.query(updateQuery, [newStatus, id]);
    const updatedAnnouncement = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: updatedAnnouncement.id,
        title: updatedAnnouncement.title,
        isActive: updatedAnnouncement.is_active
      },
      message: `Announcement ${newStatus ? 'activated' : 'deactivated'} successfully`
    });
    
  } catch (error) {
    logger.error('Error toggling announcement status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement status'
    });
  }
});

module.exports = router;