const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_system',
  charset: 'utf8mb4',
  timezone: '+00:00',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Connection pool configuration
const poolConfig = {
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(poolConfig);

// Database initialization
class Database {
  static async initialize() {
    try {
      // Test connection
      const connection = await pool.getConnection();
      console.log('Database connected successfully');
      connection.release();

      // Run schema initialization
      await this.initializeSchema();
      
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  static async initializeSchema() {
    try {
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const seedPath = path.join(__dirname, '../database/seed.sql');

      // Check if schema files exist
      try {
        await fs.access(schemaPath);
        const schemaSQL = await fs.readFile(schemaPath, 'utf8');
        
        // Split and execute schema statements
        const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await pool.execute(statement);
          }
        }
        console.log('Database schema initialized successfully');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        console.log('Schema file not found, creating basic tables...');
        await this.createBasicTables();
      }

      // Run seed data if available
      try {
        await fs.access(seedPath);
        const seedSQL = await fs.readFile(seedPath, 'utf8');
        
        const statements = seedSQL.split(';').filter(stmt => stmt.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await pool.execute(statement);
          }
        }
        console.log('Seed data inserted successfully');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('Error running seed data:', error.message);
        }
      }

    } catch (error) {
      console.error('Schema initialization failed:', error);
      throw error;
    }
  }

  static async createBasicTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'employee') DEFAULT 'employee',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Employees table
      `CREATE TABLE IF NOT EXISTS employees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT UNIQUE,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        hire_date DATE,
        job_title VARCHAR(100),
        department VARCHAR(100),
        salary DECIMAL(10,2),
        manager_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
      )`,

      // Leave types table
      `CREATE TABLE IF NOT EXISTS leave_types (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        max_days_per_year INT DEFAULT 30,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Leave balances table
      `CREATE TABLE IF NOT EXISTS leave_balances (
        id INT PRIMARY KEY AUTO_INCREMENT,
        employee_id INT NOT NULL,
        leave_type_id INT NOT NULL,
        year YEAR NOT NULL,
        total_days DECIMAL(4,1) DEFAULT 0,
        used_days DECIMAL(4,1) DEFAULT 0,
        remaining_days DECIMAL(4,1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
        UNIQUE KEY unique_employee_leave_year (employee_id, leave_type_id, year)
      )`,

      // Leave requests table
      `CREATE TABLE IF NOT EXISTS leave_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        employee_id INT NOT NULL,
        leave_type_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days_requested DECIMAL(4,1) NOT NULL,
        reason TEXT,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
        approved_by INT NULL,
        approved_at TIMESTAMP NULL,
        rejection_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
        FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
      )`,

      // Assets/Inventory table
      `CREATE TABLE IF NOT EXISTS assets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        purchase_date DATE,
        purchase_cost DECIMAL(10,2),
        current_value DECIMAL(10,2),
        assigned_to INT NULL,
        status ENUM('active', 'inactive', 'maintenance', 'disposed') DEFAULT 'active',
        location VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
      )`,

      // Financial transactions table
      `CREATE TABLE IF NOT EXISTS financial_transactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        transaction_date DATE NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        amount DECIMAL(12,2) NOT NULL,
        reference_number VARCHAR(100),
        employee_id INT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
      )`
    ];

    for (const tableSQL of tables) {
      await pool.execute(tableSQL);
    }

    console.log('Basic tables created successfully');
  }

  static getPool() {
    return pool;
  }

  static async executeQuery(query, params = []) {
    try {
      const [results] = await pool.execute(query, params);
      return results;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  static async executeTransaction(queries) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const { query, params } of queries) {
        const [result] = await connection.execute(query, params);
        results.push(result);
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async close() {
    try {
      await pool.end();
      console.log('Database connection pool closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await Database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await Database.close();
  process.exit(0);
});

module.exports = {
  Database,
  pool,
  executeQuery: Database.executeQuery,
  executeTransaction: Database.executeTransaction
};