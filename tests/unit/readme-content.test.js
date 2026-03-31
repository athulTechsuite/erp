const fs = require('fs');
const path = require('path');

describe('README.md Unit Tests', () => {
  let readmeContent;

  beforeAll(() => {
    const readmePath = path.join(__dirname, '../../README.md');
    readmeContent = fs.readFileSync(readmePath, 'utf8');
  });

  describe('Header Structure', () => {
    test('should have main title as H1', () => {
      const h1Match = readmeContent.match(/^# (.+)$/m);
      expect(h1Match).toBeTruthy();
      expect(h1Match[1]).toBe('Core ERP System with Leave Management');
    });

    test('should have proper H2 section headers', () => {
      const expectedH2Headers = [
        'Project Overview',
        'Features',
        'Technology Stack'
      ];

      expectedH2Headers.forEach(header => {
        const regex = new RegExp(`## .* ${header.replace(/\s+/g, '\\s+')}`, 'm');
        expect(readmeContent).toMatch(regex);
      });
    });

    test('should have proper H3 subsection headers', () => {
      const h3Headers = readmeContent.match(/^### (.+)$/gm);
      expect(h3Headers).toBeTruthy();
      expect(h3Headers.length).toBeGreaterThan(5);
    });
  });

  describe('Feature Lists', () => {
    test('should have properly formatted feature checkboxes', () => {
      const checkboxPattern = /^- \[x\] .+$/gm;
      const checkboxes = readmeContent.match(checkboxPattern);
      expect(checkboxes).toBeTruthy();
      expect(checkboxes.length).toBeGreaterThan(15);
    });

    test('should describe company announcements features', () => {
      const announcementSection = readmeContent.match(
        /### Company Announcements System[\s\S]*?(?=###|$)/
      );
      expect(announcementSection).toBeTruthy();
      expect(announcementSection[0]).toContain('Create and manage');
      expect(announcementSection[0]).toContain('Role-based');
      expect(announcementSection[0]).toContain('Priority levels');
    });
  });

  describe('Technology Documentation', () => {
    test('should document backend framework', () => {
      expect(readmeContent).toContain('Node.js with Express.js');
    });

    test('should document database technology', () => {
      expect(readmeContent).toContain('PostgreSQL');
    });

    test('should document authentication method', () => {
      expect(readmeContent).toContain('JWT with bcrypt');
    });

    test('should document API architecture', () => {
      expect(readmeContent).toContain('RESTful');
    });
  });

  describe('Content Quality Checks', () => {
    test('should not have typos in common words', () => {
      const commonTypos = [
        /managment/i,  // should be management
        /employe[^er]/i, // should be employee
        /seperate/i,   // should be separate
        /recieve/i     // should be receive
      ];

      commonTypos.forEach(typo => {
        expect(readmeContent).not.toMatch(typo);
      });
    });

    test('should use consistent terminology', () => {
      // Should consistently use "ERP system" not "ERP System" in content
      const erpMatches = readmeContent.match(/ERP [Ss]ystem/g) || [];
      const systemMatches = erpMatches.filter(match => match === 'ERP system');
      expect(systemMatches.length).toBeGreaterThan(0);
    });

    test('should have proper punctuation in lists', () => {
      const listItems = readmeContent.match(/^- \[x\] (.+)$/gm) || [];
      listItems.forEach(item => {
        // List items should not end with periods
        const content = item.match(/^- \[x\] (.+)$/)[1];
        expect(content).not.toMatch(/\.$/); 
      });
    });
  });

  describe('Structure Validation', () => {
    test('should have project description before features', () => {
      const overviewIndex = readmeContent.indexOf('Project Overview');
      const featuresIndex = readmeContent.indexOf('Features');
      expect(overviewIndex).toBeLessThan(featuresIndex);
    });

    test('should have features before technology stack', () => {
      const featuresIndex = readmeContent.indexOf('Features');
      const techIndex = readmeContent.indexOf('Technology Stack');
      expect(featuresIndex).toBeLessThan(techIndex);
    });

    test('should have balanced brackets in checkboxes', () => {
      const openBrackets = (readmeContent.match(/\[/g) || []).length;
      const closeBrackets = (readmeContent.match(/\]/g) || []).length;
      expect(openBrackets).toBe(closeBrackets);
    });
  });

  describe('Target Audience Information', () => {
    test('should specify company size target', () => {
      expect(readmeContent).toMatch(/fewer than 10 employees/);
    });

    test('should describe system purpose', () => {
      expect(readmeContent).toContain('comprehensive ERP system');
      expect(readmeContent).toContain('unified platform');
    });

    test('should mention key business functions', () => {
      const businessFunctions = [
        'employee data',
        'leave requests',
        'inventory',
        'financial operations'
      ];

      businessFunctions.forEach(func => {
        expect(readmeContent.toLowerCase()).toContain(func);
      });
    });
  });
});