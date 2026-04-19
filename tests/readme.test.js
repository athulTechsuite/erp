const fs = require('fs');
const path = require('path');

describe('README.md Documentation Tests', () => {
  let readmeContent;

  beforeAll(() => {
    const readmePath = path.join(__dirname, '../README.md');
    readmeContent = fs.readFileSync(readmePath, 'utf8');
  });

  describe('Basic Structure', () => {
    test('should have project title', () => {
      expect(readmeContent).toContain('Core ERP System with Leave Management');
    });

    test('should contain project overview section', () => {
      expect(readmeContent).toMatch(/## 🎯 Project Overview/);
    });

    test('should contain features section', () => {
      expect(readmeContent).toMatch(/## ✨ Features/);
    });

    test('should contain technology stack section', () => {
      expect(readmeContent).toMatch(/## 🛠️ Technology Stack/);
    });
  });

  describe('Feature Documentation', () => {
    test('should document authentication features', () => {
      expect(readmeContent).toContain('User authentication system');
      expect(readmeContent).toContain('Role-based access control');
      expect(readmeContent).toContain('Secure session management');
    });

    test('should document leave management features', () => {
      expect(readmeContent).toContain('Leave request submission workflow');
      expect(readmeContent).toContain('Manager approval/rejection system');
      expect(readmeContent).toContain('Automatic leave balance calculation');
      expect(readmeContent).toContain('Leave history tracking');
    });

    test('should document company announcements system', () => {
      expect(readmeContent).toContain('Company Announcements System');
      expect(readmeContent).toContain('Create and manage company-wide announcements');
      expect(readmeContent).toContain('Role-based announcement visibility');
      expect(readmeContent).toContain('Priority levels for announcements');
      expect(readmeContent).toContain('Read status tracking');
      expect(readmeContent).toContain('Announcement expiration dates');
    });

    test('should document employee management features', () => {
      expect(readmeContent).toContain('Employee profile creation and editing');
      expect(readmeContent).toContain('Basic HR data management');
      expect(readmeContent).toContain('Employee directory and search');
    });

    test('should document dashboard and analytics features', () => {
      expect(readmeContent).toContain('Company overview dashboard');
      expect(readmeContent).toContain('Key performance metrics');
      expect(readmeContent).toContain('Pending requests management');
    });

    test('should document reporting features', () => {
      expect(readmeContent).toContain('HR metrics reporting');
      expect(readmeContent).toContain('Leave reports generation');
      expect(readmeContent).toContain('Data export capabilities');
    });
  });

  describe('Technology Stack Documentation', () => {
    test('should document backend technologies', () => {
      expect(readmeContent).toContain('Node.js with Express.js');
      expect(readmeContent).toContain('PostgreSQL');
      expect(readmeContent).toContain('JWT with bcrypt');
    });

    test('should document API architecture', () => {
      expect(readmeContent).toContain('RESTful architecture');
      expect(readmeContent).toContain('Integration-ready architecture');
    });
  });

  describe('Feature Completion Status', () => {
    test('should show completed features with checkboxes', () => {
      const completedFeatures = readmeContent.match(/- \[x\]/g);
      expect(completedFeatures).toBeTruthy();
      expect(completedFeatures.length).toBeGreaterThan(20);
    });

    test('should not have incomplete features', () => {
      const incompleteFeatures = readmeContent.match(/- \[ \]/g);
      expect(incompleteFeatures).toBeFalsy();
    });
  });

  describe('Content Quality', () => {
    test('should have proper markdown formatting', () => {
      expect(readmeContent).toMatch(/^# .+/m);
      expect(readmeContent).toMatch(/## .+/m);
      expect(readmeContent).toMatch(/### .+/m);
    });

    test('should contain emojis in section headers', () => {
      expect(readmeContent).toContain('🎯');
      expect(readmeContent).toContain('✨');
      expect(readmeContent).toContain('🛠️');
    });

    test('should have proper bullet point formatting', () => {
      const bulletPoints = readmeContent.match(/^- /gm);
      expect(bulletPoints).toBeTruthy();
      expect(bulletPoints.length).toBeGreaterThan(10);
    });

    test('should not contain undefined values', () => {
      expect(readmeContent).not.toContain('undefined');
      expect(readmeContent).not.toContain('null');
    });

    test('should not have truncated content', () => {
      expect(readmeContent).not.toMatch(/\*\*Validatio$/m);
      expect(readmeContent).toContain('**Validation');
    });
  });

  describe('Project Description', () => {
    test('should specify target company size', () => {
      expect(readmeContent).toContain('fewer than 10 employees');
    });

    test('should describe comprehensive ERP functionality', () => {
      expect(readmeContent).toContain('comprehensive ERP system');
      expect(readmeContent).toContain('unified platform');
    });
  });
});