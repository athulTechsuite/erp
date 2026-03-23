const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    // Use environment variables for email configuration
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    return nodemailer.createTransporter(emailConfig);
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Leave request notifications
  async sendLeaveRequestNotification(leaveRequest, employee, approvers) {
    const subject = `New Leave Request - ${employee.firstName} ${employee.lastName}`;
    const html = this.generateLeaveRequestTemplate(leaveRequest, employee);
    
    const approverEmails = approvers.map(approver => approver.email);
    
    return await this.sendEmail({
      to: approverEmails,
      subject,
      html
    });
  }

  async sendLeaveApprovalNotification(leaveRequest, employee, approver) {
    const subject = `Leave Request Approved - ${this.formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}`;
    const html = this.generateLeaveApprovalTemplate(leaveRequest, employee, approver);
    
    return await this.sendEmail({
      to: employee.email,
      subject,
      html
    });
  }

  async sendLeaveRejectionNotification(leaveRequest, employee, approver) {
    const subject = `Leave Request Rejected - ${this.formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}`;
    const html = this.generateLeaveRejectionTemplate(leaveRequest, employee, approver);
    
    return await this.sendEmail({
      to: employee.email,
      subject,
      html
    });
  }

  // Password reset notifications
  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Password Reset Request';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = this.generatePasswordResetTemplate(user, resetUrl);
    
    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  // Welcome email for new employees
  async sendWelcomeEmail(user, temporaryPassword) {
    const subject = 'Welcome to the Company ERP System';
    const html = this.generateWelcomeTemplate(user, temporaryPassword);
    
    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  // Announcement notifications
  async sendUrgentAnnouncementNotification(announcement, employees) {
    const subject = `🚨 URGENT: ${announcement.title}`;
    const html = this.generateUrgentAnnouncementTemplate(announcement);
    
    const employeeEmails = employees.map(employee => employee.email);
    
    return await this.sendEmail({
      to: employeeEmails,
      subject,
      html
    });
  }

  async sendAnnouncementNotification(announcement, employees) {
    const subject = `📢 Company Announcement: ${announcement.title}`;
    const html = this.generateAnnouncementTemplate(announcement);
    
    const employeeEmails = employees.map(employee => employee.email);
    
    return await this.sendEmail({
      to: employeeEmails,
      subject,
      html
    });
  }

  // System notifications
  async sendSystemAlert(recipients, alertType, message, details = {}) {
    const subject = `System Alert: ${alertType}`;
    const html = this.generateSystemAlertTemplate(alertType, message, details);
    
    return await this.sendEmail({
      to: recipients,
      subject,
      html
    });
  }

  // Template generators
  generateLeaveRequestTemplate(leaveRequest, employee) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          New Leave Request
        </h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #007bff;">Employee Details</h3>
          <p><strong>Name:</strong> ${employee.firstName} ${employee.lastName}</p>
          <p><strong>Employee ID:</strong> ${employee.employeeId}</p>
          <p><strong>Department:</strong> ${employee.department || 'N/A'}</p>
          <p><strong>Email:</strong> ${employee.email}</p>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #007bff;">Leave Details</h3>
          <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
          <p><strong>Start Date:</strong> ${this.formatDate(leaveRequest.startDate)}</p>
          <p><strong>End Date:</strong> ${this.formatDate(leaveRequest.endDate)}</p>
          <p><strong>Duration:</strong> ${leaveRequest.duration} day(s)</p>
          ${leaveRequest.reason ? `<p><strong>Reason:</strong> ${leaveRequest.reason}</p>` : ''}
          ${leaveRequest.comments ? `<p><strong>Comments:</strong> ${leaveRequest.comments}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/leave-requests" 
             style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review Leave Request
          </a>
        </div>
        <p style="color: #6c757d; font-size: 14px; text-align: center;">
          Please log in to the ERP system to approve or reject this request.
        </p>
      </div>
    `;
  }

  generateLeaveApprovalTemplate(leaveRequest, employee, approver) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
          Leave Request Approved ✅
        </h2>
        <div style="background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
          <p>Hi ${employee.firstName},</p>
          <p>Good news! Your leave request has been approved.</p>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #28a745;">Approved Leave Details</h3>
          <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
          <p><strong>Dates:</strong> ${this.formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}</p>
          <p><strong>Duration:</strong> ${leaveRequest.duration} day(s)</p>
          <p><strong>Approved by:</strong> ${approver.firstName} ${approver.lastName}</p>
          ${leaveRequest.approverComments ? `<p><strong>Approver Comments:</strong> ${leaveRequest.approverComments}</p>` : ''}
        </div>
        <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 30px;">
          Enjoy your time off! Please ensure all your work is properly handed over before your leave begins.
        </p>
      </div>
    `;
  }

  generateLeaveRejectionTemplate(leaveRequest, employee, approver) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
          Leave Request Update ❌
        </h2>
        <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p>Hi ${employee.firstName},</p>
          <p>We regret to inform you that your leave request has been rejected.</p>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #dc3545;">Rejected Leave Details</h3>
          <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
          <p><strong>Requested Dates:</strong> ${this.formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}</p>
          <p><strong>Duration:</strong> ${leaveRequest.duration} day(s)</p>
          <p><strong>Reviewed by:</strong> ${approver.firstName} ${approver.lastName}</p>
          ${leaveRequest.approverComments ? `<p><strong>Reason for Rejection:</strong> ${leaveRequest.approverComments}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/leaves/new" 
             style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Submit New Request
          </a>
        </div>
        <p style="color: #6c757d; font-size: 14px; text-align: center;">
          If you have any questions, please contact your manager or HR department.
        </p>
      </div>
    `;
  }

  generatePasswordResetTemplate(user, resetUrl) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          Password Reset Request
        </h2>
        <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p>Hi ${user.firstName},</p>
          <p>You have requested to reset your password for the ERP system.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            <strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
          </p>
        </div>
      </div>
    `;
  }

  generateWelcomeTemplate(user, temporaryPassword) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
          Welcome to Our ERP System! 🎉
        </h2>
        <div style="background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
          <p>Hi ${user.firstName},</p>
          <p>Welcome to our team! Your ERP system account has been created.</p>
        </div>
        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #007bff;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #f8f9fa; padding: 2px 4px;">${temporaryPassword}</code></p>
          <p><strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
        </div>
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;">
            <strong>Important:</strong> Please change your password after your first login for security purposes.
          </p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/login" 
             style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Login Now
          </a>
        </div>
      </div>
    `;
  }

  generateUrgentAnnouncementTemplate(announcement) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc3545; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">🚨 URGENT ANNOUNCEMENT</h2>
        </div>
        <div style="background: #f8d7da; padding: 20px; border-left: 4px solid #dc3545;">
          <h3 style="color: #721c24; margin-top: 0; font-size: 20px;">${announcement.title}</h3>
          <div style="color: #721c24; line-height: 1.6;">
            ${announcement.content}
          </div>
          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f5c6cb;">
            <p style="margin: 5px 0; font-size: 14px; color: #721c24;">
              <strong>Published:</strong> ${this.formatDateTime(announcement.publishDate)}
            </p>
            ${announcement.expiryDate ? `
              <p style="margin: 5px 0; font-size: 14px; color: #721c24;">
                <strong>Expires:</strong> ${this.formatDateTime(announcement.expiryDate)}
              </p>
            ` : ''}
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/announcements" 
             style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            View All Announcements
          </a>
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
            This is an urgent company announcement. Please read and acknowledge in the ERP system.
          </p>
        </div>
      </div>
    `;
  }

  generateAnnouncementTemplate(announcement) {
    const priorityColor = announcement.priority === 'high' ? '#ffc107' : '#007bff';
    const priorityBg = announcement.priority === 'high' ? '#fff3cd' : '#cce7ff';
    const priorityIcon = announcement.priority === 'high' ? '📢' : '📋';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${priorityColor}; color: ${announcement.priority === 'high' ? '#856404' : 'white'}; padding: 15px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0; font-size: 22px;">${priorityIcon} Company Announcement</h2>
        </div>
        <div style="background: ${priorityBg}; padding: 20px; ${announcement.priority === 'high' ? 'border-left: 4px solid #ffc107;' : 'border-left: 4px solid #007bff;'}">
          <h3 style="color: ${announcement.priority === 'high' ? '#856404' : '#004085'}; margin-top: 0; font-size: 20px;">${announcement.title}</h3>
          <div style="color: ${announcement.priority === 'high' ? '#856404' : '#004085'}; line-height: 1.6;">
            ${announcement.content}
          </div>
          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid ${announcement.priority === 'high' ? '#ffeaa7' : '#b3d7ff'};">
            <p style="margin: 5px 0; font-size: 14px; color: ${announcement.priority === 'high' ? '#856404' : '#004085'};">
              <strong>Published:</strong> ${this.formatDateTime(announcement.publishDate)}
            </p>
            ${announcement.expiryDate ? `
              <p style="margin: 5px 0; font-size: 14px; color: ${announcement.priority === 'high' ? '#856404' : '#004085'};">
                <strong>Expires:</strong> ${this.formatDateTime(announcement.expiryDate)}
              </p>
            ` : ''}
            ${announcement.priority ? `
              <p style="margin: 5px 0; font-size: 14px; color: ${announcement.priority === 'high' ? '#856404' : '#004085'};">
                <strong>Priority:</strong> ${announcement.priority.toUpperCase()}
              </p>
            ` : ''}
          </div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/announcements" 
             style="background: ${priorityColor}; color: ${announcement.priority === 'high' ? '#856404' : 'white'}; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View All Announcements
          </a>
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
            Log in to the ERP system to mark this announcement as read and view other company updates.
          </p>
        </div>
      </div>
    `;
  }

  generateSystemAlertTemplate(alertType, message, details) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
          System Alert: ${alertType} ⚠️
        </h2>
        <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p><strong>Alert Message:</strong> ${message}</p>
        </div>
        ${Object.keys(details).length > 0 ? `
        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
          <h3 style="margin-top: 0;">Details</h3>
          ${Object.entries(details).map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`).join('')}
        </div>
        ` : ''}
        <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 30px;">
          This is an automated system alert. Please check the system dashboard for more information.
        </p>
      </div>
    `;
  }

  // Utility methods
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateRange(startDate, endDate) {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    return start === end ? start : `${start} to ${end}`;
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Test email connectivity
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service is ready');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();