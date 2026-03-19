import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiPlus, FiEdit, FiTrash2, FiEye, FiFilter } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import ErrorMessage from '../Common/ErrorMessage';
import ConfirmDialog from '../Common/ConfirmDialog';
import './EmployeeList.css';

const EmployeeList = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, employee: null });

  // Unique departments for filter dropdown
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, departmentFilter, statusFilter]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getAllEmployees();
      setEmployees(data);
      
      // Extract unique departments
      const uniqueDepartments = [...new Set(data.map(emp => emp.department).filter(Boolean))];
      setDepartments(uniqueDepartments);
    } catch (err) {
      setError('Failed to load employees');
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = employees;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(employee =>
        employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Department filter
    if (departmentFilter) {
      filtered = filtered.filter(employee => employee.department === departmentFilter);
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(employee => employee.status === statusFilter);
    }

    setFilteredEmployees(filtered);
  };

  const handleDeleteEmployee = async (employee) => {
    try {
      await employeeService.deleteEmployee(employee.id);
      setEmployees(employees.filter(emp => emp.id !== employee.id));
      setDeleteDialog({ open: false, employee: null });
    } catch (err) {
      setError('Failed to delete employee');
      console.error('Error deleting employee:', err);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      active: 'status-badge status-active',
      inactive: 'status-badge status-inactive',
      on_leave: 'status-badge status-leave'
    };

    const statusText = {
      active: 'Active',
      inactive: 'Inactive',
      on_leave: 'On Leave'
    };

    return (
      <span className={statusClasses[status] || 'status-badge'}>
        {statusText[status] || status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canManageEmployees = user?.role === 'admin' || user?.role === 'hr';

  if (loading) return <LoadingSpinner />;

  return (
    <div className="employee-list">
      <div className="page-header">
        <div className="header-content">
          <h1>Employees</h1>
          <p>Manage your company's workforce</p>
        </div>
        {canManageEmployees && (
          <Link to="/employees/new" className="btn btn-primary">
            <FiPlus className="btn-icon" />
            Add Employee
          </Link>
        )}
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="filters-section">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <FiFilter className="filter-icon" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
        </div>
      </div>

      <div className="employees-grid">
        {filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <p>No employees found matching your criteria.</p>
            {canManageEmployees && (
              <Link to="/employees/new" className="btn btn-outline">
                Add First Employee
              </Link>
            )}
          </div>
        ) : (
          <div className="employee-cards">
            {filteredEmployees.map(employee => (
              <div key={employee.id} className="employee-card">
                <div className="employee-avatar">
                  {employee.profilePicture ? (
                    <img src={employee.profilePicture} alt={`${employee.firstName} ${employee.lastName}`} />
                  ) : (
                    <div className="avatar-placeholder">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </div>
                  )}
                </div>

                <div className="employee-info">
                  <h3 className="employee-name">
                    {employee.firstName} {employee.lastName}
                  </h3>
                  <p className="employee-title">{employee.position}</p>
                  <p className="employee-department">{employee.department}</p>
                  <p className="employee-id">ID: {employee.employeeId}</p>
                </div>

                <div className="employee-meta">
                  <div className="status-section">
                    {getStatusBadge(employee.status)}
                  </div>
                  <p className="join-date">
                    Joined: {formatDate(employee.hireDate)}
                  </p>
                </div>

                <div className="employee-actions">
                  <Link
                    to={`/employees/${employee.id}`}
                    className="action-btn view-btn"
                    title="View Details"
                  >
                    <FiEye />
                  </Link>
                  
                  {canManageEmployees && (
                    <>
                      <Link
                        to={`/employees/${employee.id}/edit`}
                        className="action-btn edit-btn"
                        title="Edit Employee"
                      >
                        <FiEdit />
                      </Link>
                      
                      <button
                        onClick={() => setDeleteDialog({ open: true, employee })}
                        className="action-btn delete-btn"
                        title="Delete Employee"
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>

                <div className="employee-contact">
                  <p className="employee-email">{employee.email}</p>
                  <p className="employee-phone">{employee.phone}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Table View */}
      <div className="employees-table-mobile">
        <div className="table-container">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Department</th>
                <th>Status</th>
                <th>Hire Date</th>
                {canManageEmployees && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee.id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar-small">
                        {employee.profilePicture ? (
                          <img src={employee.profilePicture} alt={`${employee.firstName} ${employee.lastName}`} />
                        ) : (
                          <div className="avatar-placeholder-small">
                            {employee.firstName[0]}{employee.lastName[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="employee-name-small">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="employee-id-small">
                          {employee.employeeId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{employee.position}</td>
                  <td>{employee.department}</td>
                  <td>{getStatusBadge(employee.status)}</td>
                  <td>{formatDate(employee.hireDate)}</td>
                  {canManageEmployees && (
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/employees/${employee.id}`}
                          className="action-btn-small view-btn"
                          title="View"
                        >
                          <FiEye />
                        </Link>
                        <Link
                          to={`/employees/${employee.id}/edit`}
                          className="action-btn-small edit-btn"
                          title="Edit"
                        >
                          <FiEdit />
                        </Link>
                        <button
                          onClick={() => setDeleteDialog({ open: true, employee })}
                          className="action-btn-small delete-btn"
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, employee: null })}
        onConfirm={() => handleDeleteEmployee(deleteDialog.employee)}
        title="Delete Employee"
        message={`Are you sure you want to delete ${deleteDialog.employee?.firstName} ${deleteDialog.employee?.lastName}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
      />
    </div>
  );
};

export default EmployeeList;