# Implement Company Announcements System with Dashboard Widget

## Summary
The application needs a Company Announcements system that allows administrators to create and manage company-wide announcements. The system should include a dedicated announcements section for employees to view messages and a Global Announcement widget on the dashboard for admins to post news. Features include creation, editing, deletion, automatic archiving, and chronological display of announcements.

## Approved Story and Acceptance Criteria
## User Story
As a company administrator, I want to create and manage company-wide announcements through a dedicated system and dashboard widget so that I can effectively communicate important information to all employees in centralized, easily accessible locations.

## Acceptance Criteria
- [ ] Administrator can create new announcements with title, content, publication date, and optional expiration date that persist in the system database
- [ ] A "Global Announcement" widget appears on the admin dashboard displaying recent announcements with options to create, edit, and manage posts directly from the dashboard
- [ ] All employees can view active announcements in a dedicated announcements section accessible from the main navigation, displaying in reverse chronological order with clear timestamps and author information
- [ ] Administrator can edit existing announcements through either the dashboard widget or announcements section, with changes immediately visible to all users across both locations
- [ ] Administrator can delete announcements from either interface, permanently removing them from employee view with appropriate confirmation dialogs to prevent accidental deletion
- [ ] System automatically archives expired announcements so they no longer appear in active lists but remain accessible in a separate archive section, with clear visual indicators distinguishing active from archived content
