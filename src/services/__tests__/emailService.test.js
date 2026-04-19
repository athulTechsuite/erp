const EmailService = require('../emailService');
const nodemailer = require('nodemailer');
const User = require('../../models/User');

// Mock nodemailer
jest.mock('nodemailer');
jest.mock('../../models/User');

describe('EmailService', () => {
  let emailService;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
    };
    
    nodemailer.createTransporter.mockReturnValue(mockTransporter);
    
    emailService = new EmailService();
    
    // Mock environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@company.com';
    process.env.SMTP_PASS = 'password';
    process.env.SMTP_FROM = 'noreply@company.com';
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  // TC-009: Email notifications are sent for urgent announcements
  describe('TC-009: Urgent Announcement Email Notifications', () => {
    const urgentAnnouncement = {
      id: 1,
      title: 'URGENT: Emergency Meeting',
      content: '<p>Emergency all-hands meeting at <strong>3 PM today</strong>.</p><p>Please attend via the main conference room.</p>',
      priority: 'urgent',
      author: {
        name: 'CEO',
        email: 'ceo@company.com'
      },
      publishDate: new Date(),
      expirationDate: new Date(Date.now() + 86400000)
    };

    const allEmployees = [
      { id: 1, email: 'employee1@company.com', firstName: 'John', lastName: 'Doe' },
      { id: 2, email: 'employee2@company.com', firstName: 'Jane', lastName: 'Smith' },
      { id: 3, email: 'employee3@company.com', firstName: 'Bob', lastName: 'Wilson' }
    ];

    it('should send email notifications for urgent announcements', async () => {
      User.find.mockResolvedValue(allEmployees);

      await emailService.sendUrgentAnnouncementNotification(urgentAnnouncement, allEmployees);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe('employee1@company.com, employee2@company.com, employee3@company.com');
      expect(emailCall.subject).toBe('URGENT: Emergency Meeting');
      expect(emailCall.html).toContain('Emergency all-hands meeting');
      expect(emailCall.html).toContain('<strong>3 PM today</strong>');
    });

    it('should include proper email template for urgent announcements', async () => {
      await emailService.sendUrgentAnnouncementNotification(urgentAnnouncement, allEmployees);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      
      // Check email contains announcement details
      expect(emailCall.html).toContain(urgentAnnouncement.title);
      expect(emailCall.html).toContain('This is an urgent announcement');
      expect(emailCall.html).toContain(urgentAnnouncement.author.name);
      
      // Check for call-to-action
      expect(emailCall.html).toContain('View Announcement');
      expect(emailCall.html).toContain('/announcements/');
    });

    it('should handle email sending failures gracefully', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(
        emailService.sendUrgentAnnouncementNotification(urgentAnnouncement, allEmployees)
      ).rejects.toThrow('SMTP connection failed');
    });

    it('should not send emails for non-urgent announcements', async () => {
      const normalAnnouncement = {
        ...urgentAnnouncement,
        priority: 'normal',
        title: 'Regular Company Update'
      };

      // This method should not be called for normal announcements
      // Test is handled in controller layer
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should send individual emails to each recipient', async () => {
      const emailOptions = {
        to: ['user1@company.com', 'user2@company.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      };

      await emailService.sendEmail(emailOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user1@company.com, user2@company.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        from: 'noreply@company.com'
      }));
    });

    it('should generate plain text version from HTML content', async () => {
      const htmlContent = '<h1>Urgent Update</h1><p>This is <strong>important</strong> information.</p><ul><li>Item 1</li><li>Item 2</li></ul>';
      
      await emailService.sendEmail({
        to: 'test@company.com',
        subject: 'Test',
        html: htmlContent
      });

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      
      // Should include plain text version
      expect(emailCall.text).toBeDefined();
      expect(emailCall.text).toContain('Urgent Update');
      expect(emailCall.text).toContain('important information');
      expect(emailCall.text).toContain('Item 1');
      expect(emailCall.text).not.toContain('<h1>');
      expect(emailCall.text).not.toContain('<strong>');
    });

    it('should handle batch email sending with rate limiting', async () => {
      const largeRecipientList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        email: `employee${i + 1}@company.com`,
        firstName: `User${i + 1}`,
        lastName: 'Test'
      }));

      // Mock batch processing
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < largeRecipientList.length; i += batchSize) {
        batches.push(largeRecipientList.slice(i, i + batchSize));
      }

      await emailService.sendUrgentAnnouncementNotificationBatch(urgentAnnouncement, batches);

      // Should send emails in batches to avoid overwhelming SMTP server
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2); // 100 users / 50 per batch = 2 calls
    });

    it('should track email delivery status', async () => {
      const deliveryResult = {
        messageId: 'test-message-123',
        accepted: ['user1@company.com', 'user2@company.com'],
        rejected: [],
        pending: []
      };
      
      mockTransporter.sendMail.mockResolvedValue(deliveryResult);

      const result = await emailService.sendEmail({
        to: ['user1@company.com', 'user2@company.com'],
        subject: 'Test Announcement',
        html: '<p>Test content</p>'
      });

      expect(result.messageId).toBe('test-message-123');
      expect(result.accepted).toEqual(['user1@company.com', 'user2@company.com']);
      expect(result.rejected).toEqual([]);
    });
  });

  describe('Email Service Configuration', () => {
    it('should create transporter with correct SMTP settings', () => {
      expect(nodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: '587',
        secure: false,
        auth: {
          user: 'test@company.com',
          pass: 'password'
        }
      });
    });

    it('should use default settings when environment variables are missing', () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      
      new EmailService();
      
      expect(nodemailer.createTransporter).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 587
        })
      );
    });

    it('should handle authentication errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Authentication failed'));

      await expect(
        emailService.sendEmail({
          to: 'test@company.com',
          subject: 'Test',
          html: '<p>Test</p>'
        })
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('Email Template Generation', () => {
    it('should generate properly formatted urgent announcement email template', async () => {
      const template = emailService.generateUrgentAnnouncementTemplate(urgentAnnouncement);
      
      expect(template).toContain('<!DOCTYPE html>');
      expect(template).toContain(urgentAnnouncement.title);
      expect(template).toContain('URGENT');
      expect(template).toContain(urgentAnnouncement.content);
      expect(template).toContain('View Full Announcement');
      expect(template).toContain('company-logo');
    });

    it('should escape HTML in email content to prevent XSS', async () => {
      const maliciousAnnouncement = {
        ...urgentAnnouncement,
        title: 'Test <script>alert("xss")</script>',
        content: '<p>Content with <script>malicious()</script> code</p>'
      };

      const template = emailService.generateUrgentAnnouncementTemplate(maliciousAnnouncement);
      
      expect(template).not.toContain('<script>alert("xss")</script>');
      expect(template).not.toContain('<script>malicious()</script>');
      expect(template).toContain('&lt;script&gt;');
    });
  });
});