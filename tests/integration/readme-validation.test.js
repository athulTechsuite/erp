const fs = require('fs');
const path = require('path');
const markdownlint = require('markdownlint');

describe('README.md Integration Tests', () => {
  let readmePath;
  let readmeContent;

  beforeAll(() => {
    readmePath = path.join(__dirname, '../../README.md');
    readmeContent = fs.readFileSync(readmePath, 'utf8');
  });

  describe('Markdown Linting', () => {
    test('should pass markdown linting rules', async () => {
      const options = {
        files: [readmePath],
        config: {
          'default': true,
          'MD013': false, // line length
          'MD033': false, // allow HTML
          'MD041': false  // first line in file should be a top level header
        }
      };

      const result = markdownlint.sync(options);
      const issues = result[readmePath] || [];
      
      expect(issues.length).toBe(0);
    });
  });

  describe('Feature Implementation Validation', () => {
    test('should have implementation files for documented features', () => {
      // Check if key implementation directories exist
      const expectedDirs = [
        'src',
        'routes',
        'models',
        'controllers'
      ];

      expectedDirs.forEach(dir => {
        const dirPath = path.join(__dirname, '../../', dir);
        if (fs.existsSync(dirPath)) {
          expect(fs.statSync(dirPath).isDirectory()).toBe(true);
        }
      });
    });

    test('should have package.json with documented technologies', () => {
      const packagePath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(packagePath)) {
        const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Check for documented backend technologies
        if (packageContent.dependencies) {
          const deps = packageContent.dependencies;
          // These would be expected based on the README
          expect(deps.express || deps['express.js']).toBeDefined();
        }
      }
    });
  });

  describe('Documentation Completeness', () => {
    test('should document all major system components', () => {
      const requiredSections = [
        'Authentication & Access Control',
        'Employee Management',
        'Leave Management',
        'Company Announcements System',
        'Dashboard & Analytics',
        'Reporting & Export'
      ];

      requiredSections.forEach(section => {
        expect(readmeContent).toContain(section);
      });
    });

    test('should have consistent feature status indicators', () => {
      const lines = readmeContent.split('\n');
      const featureLines = lines.filter(line => line.trim().startsWith('- ['));
      
      featureLines.forEach(line => {
        // All features should be marked as completed [x]
        expect(line).toMatch(/- \[x\]/);
      });
    });
  });

  describe('Content Accuracy', () => {
    test('should have accurate project description', () => {
      expect(readmeContent).toContain('ERP system');
      expect(readmeContent).toContain('leave management');
      expect(readmeContent).toContain('small companies');
    });

    test('should list all announced system features', () => {
      const announcementFeatures = [
        'Create and manage company-wide announcements',
        'Role-based announcement visibility',
        'Priority levels for announcements',
        'Read status tracking',
        'Announcement expiration dates'
      ];

      announcementFeatures.forEach(feature => {
        expect(readmeContent).toContain(feature);
      });
    });

    test('should not contain placeholder or incomplete text', () => {
      expect(readmeContent).not.toContain('TODO');
      expect(readmeContent).not.toContain('TBD');
      expect(readmeContent).not.toContain('[INSERT');
      expect(readmeContent).not.toMatch(/\*\*Validatio$/); // truncated validation section
    });
  });

  describe('File Structure Validation', () => {
    test('should be properly formatted markdown file', () => {
      expect(path.extname(readmePath)).toBe('.md');
      expect(readmeContent.length).toBeGreaterThan(100);
    });

    test('should have proper encoding', () => {
      // File should not contain encoding issues
      expect(readmeContent).not.toContain('\uFFFD'); // replacement character
    });
  });
});