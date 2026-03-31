# Core ERP System with Leave Management

A comprehensive ERP system designed specifically for small companies with fewer than 10 employees, featuring integrated leave management and core business operations management.

## 🎯 Project Overview

This system provides a unified platform for managing employee data, leave requests, inventory tracking, and basic financial operations, streamlining business processes for small organizations.

## ✨ Features

### Authentication & Access Control
- [x] User authentication system
- [x] Role-based access control (Admin, Manager, Employee)
- [x] Secure session management

### Employee Management
- [x] Employee profile creation and editing
- [x] Basic HR data management
- [x] Employee directory and search

### Leave Management
- [x] Leave request submission workflow
- [x] Manager approval/rejection system
- [x] Automatic leave balance calculation
- [x] Leave history tracking
- [x] Multiple leave types support (Annual, Sick, Emergency, Maternity, Paternity, Bereavement)

### Dashboard & Analytics
- [x] Company overview dashboard
- [x] Key performance metrics
- [x] Pending requests management
- [x] Real-time status updates

### Reporting & Export
- [x] HR metrics reporting
- [x] Leave reports generation
- [x] Data export capabilities (CSV, PDF)
- [x] Custom report filtering

### Additional ERP Features
- [x] Basic inventory/asset tracking
- [x] Financial overview dashboard
- [x] Expense tracking
- [x] Basic accounting features

### Technical Features
- [x] Responsive design (desktop & mobile)
- [x] Integration-ready architecture
- [x] RESTful API structure
- [x] Database optimization

## 🛠️ Technology Stack

### Backend
- **Framework:** Node.js with Express.js
- **Database:** PostgreSQL with connection pooling and prepared statements for SQL injection prevention
- **Authentication:** JWT with bcrypt (minimum 12 rounds)
- **API:** RESTful architecture with rate limiting
- **Validation:** Joi schema validation with input sanitization
- **ORM:** Knex.js with parameterized queries and transaction support

### Frontend
- **Framework:** React.js with JavaScript
- **State Management:** React Context API with useMemo/useCallback optimization and race condition prevention through proper dependency management
- **UI Components:** Custom components with modern CSS
- **Styling:** CSS3 with Flexbox/Grid
- **Forms:** Controlled components with validation

### DevOps & Tools
- **Containerization:** Docker
- **Process Management:** PM2 with cluster mode
- **Database Migration:** Knex.js
- **Testing:** Jest & React Testing Library
- **Code Quality:** ESLint, Prettier

## 📋 Prerequisites

- Node.js (v16.0 or higher)
- PostgreSQL (v12.0 or higher)
- Docker (optional, for containerization)
- Git

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd core-erp-system
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure your database and API settings
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

### 4. Development Server
```bash
# Start backend server
npm run dev:server

# Start frontend development server (in new terminal)
npm run dev:client

# Or start both concurrently
npm run dev
```

### 5. Production Build
```bash
# Build for production
npm run build

# Start production server
npm run start
```

## 📁 Project Structure

```
core-erp-system/
├── server/                 # Backend application
│   ├── controllers/        # API controllers
│   ├── middleware/         # Express middleware
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── migrations/        # Database migrations
├── client/                # Frontend application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── store/         # Redux store
│   │   ├── services/      # API services
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── shared/                # Shared types and utilities
├── docs/                  # Documentation
├── tests/                 # Test files
└── docker/               # Docker configuration
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token

### Employee Management
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Leave Management
- `GET /api/leaves` - List leave requests
- `POST /api/leaves` - Submit leave request
- `PUT /api/leaves/:id/approve` - Approve leave
- `PUT /api/leaves/:id/reject` - Reject leave
- `GET /api/leaves/balance/:employeeId` - Get leave balance

### Reports
- `GET /api/reports/hr` - HR metrics
- `GET /api/reports/leaves` - Leave reports
- `POST /api/reports/export` - Export data

## 🎨 UI Components

### Core Components
- **Dashboard:** Overview metrics and quick actions
- **Employee Directory:** Searchable employee list
- **Leave Request Form:** Multi-step leave submission
- **Approval Queue:** Manager approval interface
- **Reports Dashboard:** Analytics and export tools

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interfaces
- Accessible navigation

## 🧪 Testing

```bash
# Run all tests
npm test

# Run backend tests
npm run test:server

# Run frontend tests
npm run test:client

# Run tests with coverage
npm run test:coverage
```

## 📊 Database Schema

### Key Tables
- **users** - Authentication and basic user data
- **employees** - Employee profiles and HR data
- **leave_requests** - Leave applications and status
- **leave_balances** - Employee leave entitlements
- **departments** - Organizational structure
- **assets** - Inventory and asset tracking

### Enum Values
- **leave_status**: PENDING, APPROVED, REJECTED, CANCELLED, WITHDRAWN
- **leave_types**: ANNUAL, SICK, EMERGENCY, MATERNITY, PATERNITY, BEREAVEMENT, UNPAID, COMPENSATORY, STUDY
- **user_roles**: ADMIN, MANAGER, EMPLOYEE, HR_ADMIN, FINANCE_ADMIN, READONLY
- **asset_status**: ACTIVE, INACTIVE, MAINTENANCE, DISPOSED, RESERVED, PENDING_APPROVAL
- **request_priority**: LOW, NORMAL, HIGH, URGENT, CRITICAL
- **employment_status**: ACTIVE, INACTIVE, TERMINATED, ON_LEAVE, PROBATION, SUSPENDED

## 🔒 Security Features

### Data Protection & SQL Safety
- **SQL Injection Prevention**: All database queries use parameterized statements with Knex.js
- **Input Sanitization**: Comprehensive validation with Joi schemas to prevent XSS attacks
- **Database Encryption**: SSL/TLS encryption for all database connections
- **Prepared Statements**: All user inputs processed through prepared statements
- **Query Validation**: Strict validation of all database operations

### Authentication & Authorization
- **JWT Security**: Secure token-based authentication with automatic rotation
- **Password Security**: bcrypt hashing with minimum 12 rounds and salt
- **Role-based Access**: Granular permission system with enum-validated roles
- **Session Management**: Secure session handling with timeout and refresh mechanisms
- **Rate Limiting**: API endpoints protected against brute force attacks

### Concurrency & Race Condition Prevention
- **Database Transactions**: ACID-compliant transactions for data consistency with proper isolation levels
- **Row-level Locking**: SELECT FOR UPDATE queries prevent concurrent modification conflicts
- **Optimistic Locking**: Version-based conflict detection with retry mechanisms for critical updates
- **Connection Pooling**: Thread-safe database connection management with proper cleanup
- **State Synchronization**: React concurrent mode with proper dependency arrays and useCallback/useMemo optimization
- **Atomic Operations**: Critical business operations wrapped in atomic transactions with rollback support
- **Queue Management**: Sequential processing of concurrent requests using task queues
- **Mutex Implementation**: Critical sections protected with application-level locking mechanisms

### Comprehensive Security Measures
- **Audit Logging**: Complete audit trail for all sensitive operations
- **Error Handling**: Secure error responses without information disclosure
- **CORS Configuration**: Strict cross-origin resource sharing policies
- **Headers Security**: Security headers including HSTS, CSP, and X-Frame-Options
- **Environment Security**: Secure configuration management and secret handling

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale services
docker-compose up --scale api=3
```

### Manual Deployment
```bash
# Build production assets
npm run build

# Start with PM2
npm run start:prod
```

## 📈 Performance Optimization

- Database indexing strategy with composite indexes
- API response caching with Redis
- Connection pooling for database operations
- Image optimization and lazy loading
- Code splitting and bundle optimization
- Database query optimization with EXPLAIN ANALYZE
- Concurrent processing with worker threads
- Database transaction management for data consistency

## 🔮 Future Enhancements

- [ ] Advanced reporting and analytics
- [ ] Integration with external HR systems
- [ ] Mobile app development
- [ ] Advanced workflow automation
- [ ] Multi-company support
- [ ] Advanced financial modules
- [ ] Real-time notifications with WebSockets
- [ ] Advanced audit trails and compliance reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the [documentation](docs/)
- Review the [FAQ](docs/FAQ.md)

## 📚 Documentation

- [API Documentation](docs/api.md)
- [User Guide](docs/user-guide.md)
- [Admin Guide](docs/admin-guide.md)
- [Development Guide](docs/development.md)
- [Security Guide](docs/security.md)
- [Database Schema](docs/database-schema.md)

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Minimum Requirements:** Node.js 16+, PostgreSQL 12+