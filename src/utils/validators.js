/**
 * Validation utilities for ERP system
 * Provides form validation, data sanitization, and business rule validation
 */

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation
export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
    errors: {
      minLength: password.length < minLength,
      hasUpperCase: !hasUpperCase,
      hasLowerCase: !hasLowerCase,
      hasNumbers: !hasNumbers,
      hasSpecialChar: !hasSpecialChar
    }
  };
};

// Phone number validation
export const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

// Required field validation
export const validateRequired = (value) => {
  return value !== null && value !== undefined && value.toString().trim() !== '';
};

// Employee ID validation
export const validateEmployeeId = (employeeId) => {
  const employeeIdRegex = /^[A-Z0-9]{3,10}$/;
  return employeeIdRegex.test(employeeId);
};

// Date validation
export const validateDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

// Date range validation
export const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return {
    isValid: start <= end,
    error: start > end ? 'End date must be after start date' : null
  };
};

// Leave days validation
export const validateLeaveDays = (startDate, endDate, leaveType = 'full') => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    return { isValid: false, error: 'Invalid date range' };
  }

  const timeDiff = end.getTime() - start.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

  if (leaveType === 'half' && daysDiff > 1) {
    return { isValid: false, error: 'Half day leave can only be for single day' };
  }

  return { isValid: true, days: leaveType === 'half' ? 0.5 : daysDiff };
};

// Leave balance validation
export const validateLeaveBalance = (requestedDays, availableBalance, leaveType) => {
  const balanceForType = availableBalance[leaveType] || 0;
  
  return {
    isValid: requestedDays <= balanceForType,
    error: requestedDays > balanceForType ? 
      `Insufficient ${leaveType} leave balance. Available: ${balanceForType} days` : null
  };
};

// Salary validation
export const validateSalary = (salary) => {
  const salaryNum = parseFloat(salary);
  return !isNaN(salaryNum) && salaryNum >= 0;
};

// Department validation
export const validateDepartment = (department, validDepartments = []) => {
  if (validDepartments.length === 0) return true;
  return validDepartments.includes(department);
};

// File validation
export const validateFile = (file, allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  const errors = [];

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  if (file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Form validation helper
export const validateForm = (formData, validationRules) => {
  const errors = {};
  let isValid = true;

  Object.keys(validationRules).forEach(field => {
    const rules = validationRules[field];
    const value = formData[field];
    const fieldErrors = [];

    // Required validation
    if (rules.required && !validateRequired(value)) {
      fieldErrors.push(`${field} is required`);
      isValid = false;
    }

    // Skip other validations if field is empty and not required
    if (!validateRequired(value) && !rules.required) {
      return;
    }

    // Email validation
    if (rules.email && !validateEmail(value)) {
      fieldErrors.push('Invalid email format');
      isValid = false;
    }

    // Phone validation
    if (rules.phone && !validatePhone(value)) {
      fieldErrors.push('Invalid phone number');
      isValid = false;
    }

    // Min length validation
    if (rules.minLength && value.length < rules.minLength) {
      fieldErrors.push(`Minimum length is ${rules.minLength} characters`);
      isValid = false;
    }

    // Max length validation
    if (rules.maxLength && value.length > rules.maxLength) {
      fieldErrors.push(`Maximum length is ${rules.maxLength} characters`);
      isValid = false;
    }

    // Custom validation
    if (rules.custom && typeof rules.custom === 'function') {
      const customResult = rules.custom(value, formData);
      if (!customResult.isValid) {
        fieldErrors.push(customResult.error);
        isValid = false;
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  });

  return { isValid, errors };
};

// Business hours validation
export const validateBusinessHours = (date, businessHours = { start: 9, end: 17 }) => {
  const hour = new Date(date).getHours();
  return hour >= businessHours.start && hour < businessHours.end;
};

// Working day validation (excluding weekends)
export const validateWorkingDay = (date, excludeWeekends = true, holidays = []) => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  
  // Check weekends
  if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return { isValid: false, error: 'Cannot select weekends' };
  }

  // Check holidays
  const dateString = dateObj.toISOString().split('T')[0];
  if (holidays.includes(dateString)) {
    return { isValid: false, error: 'Cannot select holiday dates' };
  }

  return { isValid: true };
};

// Asset/Inventory validation
export const validateAsset = (assetData) => {
  const errors = {};

  if (!validateRequired(assetData.name)) {
    errors.name = 'Asset name is required';
  }

  if (!validateRequired(assetData.category)) {
    errors.category = 'Asset category is required';
  }

  if (assetData.quantity !== undefined && (isNaN(assetData.quantity) || assetData.quantity < 0)) {
    errors.quantity = 'Quantity must be a valid non-negative number';
  }

  if (assetData.cost !== undefined && (isNaN(assetData.cost) || assetData.cost < 0)) {
    errors.cost = 'Cost must be a valid non-negative number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Financial validation
export const validateAmount = (amount, currency = 'USD') => {
  const amountNum = parseFloat(amount);
  
  if (isNaN(amountNum)) {
    return { isValid: false, error: 'Invalid amount format' };
  }

  if (amountNum < 0) {
    return { isValid: false, error: 'Amount cannot be negative' };
  }

  // Check decimal places based on currency
  const decimalPlaces = currency === 'USD' ? 2 : 2; // Can be extended for other currencies
  const decimalCount = (amountNum.toString().split('.')[1] || '').length;
  
  if (decimalCount > decimalPlaces) {
    return { isValid: false, error: `Maximum ${decimalPlaces} decimal places allowed` };
  }

  return { isValid: true };
};

// Sanitization utilities
export const sanitizeString = (str) => {
  return str.toString().trim().replace(/[<>]/g, '');
};

export const sanitizeNumber = (num) => {
  const parsed = parseFloat(num);
  return isNaN(parsed) ? 0 : parsed;
};

export const sanitizeInteger = (num) => {
  const parsed = parseInt(num, 10);
  return isNaN(parsed) ? 0 : parsed;
};

// Export default validation helper
export default {
  validateEmail,
  validatePassword,
  validatePhone,
  validateRequired,
  validateEmployeeId,
  validateDate,
  validateDateRange,
  validateLeaveDays,
  validateLeaveBalance,
  validateSalary,
  validateDepartment,
  validateFile,
  validateForm,
  validateBusinessHours,
  validateWorkingDay,
  validateAsset,
  validateAmount,
  sanitizeString,
  sanitizeNumber,
  sanitizeInteger
};