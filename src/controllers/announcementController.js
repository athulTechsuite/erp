const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');

// Get all published announcements for dashboard widget
const getPublishedAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find({ isPublished: true })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title content createdAt');
        
        res.json({
            success: true,
            data: announcements
        });
    } catch (error) {
        console.error('Error fetching published announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching announcements'
        });
    }
};

// Get all announcements for admin management (published and unpublished)
const getAllAnnouncements = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .select('title content isPublished createdAt updatedAt');
        
        res.json({
            success: true,
            data: announcements
        });
    } catch (error) {
        console.error('Error fetching all announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching announcements'
        });
    }
};

// Create new announcement (admin only)
const createAnnouncement = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { title, content, isPublished = false } = req.body;

        const announcement = new Announcement({
            title: title.trim(),
            content: content.trim(),
            isPublished,
            createdBy: req.user.id
        });

        const savedAnnouncement = await announcement.save();
        
        res.status(201).json({
            success: true,
            message: 'Announcement created successfully',
            data: savedAnnouncement
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating announcement'
        });
    }
};

// Update announcement (admin only)
const updateAnnouncement = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { title, content, isPublished } = req.body;

        const announcement = await Announcement.findById(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        // Update fields
        announcement.title = title.trim();
        announcement.content = content.trim();
        announcement.isPublished = isPublished;
        announcement.updatedAt = new Date();

        const updatedAnnouncement = await announcement.save();
        
        res.json({
            success: true,
            message: 'Announcement updated successfully',
            data: updatedAnnouncement
        });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating announcement'
        });
    }
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        const { id } = req.params;

        const announcement = await Announcement.findById(id);
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        await Announcement.findByIdAndDelete(id);
        
        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting announcement'
        });
    }
};

// Get single announcement by ID (admin only)
const getAnnouncementById = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        const { id } = req.params;
        const announcement = await Announcement.findById(id);
        
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        res.json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error('Error fetching announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching announcement'
        });
    }
};

// Toggle publication status (admin only)
const togglePublishStatus = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        const { id } = req.params;
        const announcement = await Announcement.findById(id);
        
        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        announcement.isPublished = !announcement.isPublished;
        announcement.updatedAt = new Date();
        
        const updatedAnnouncement = await announcement.save();
        
        res.json({
            success: true,
            message: `Announcement ${updatedAnnouncement.isPublished ? 'published' : 'unpublished'} successfully`,
            data: updatedAnnouncement
        });
    } catch (error) {
        console.error('Error toggling publish status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating announcement status'
        });
    }
};

module.exports = {
    getPublishedAnnouncements,
    getAllAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getAnnouncementById,
    togglePublishStatus
};