// Leave calculation utilities for ERP system
// Handles leave balance calculations, working days, and leave entitlements

/**
 * Calculate working days between two dates (excluding weekends)
 * @param {Date} startDate - Start date of leave
 * @param {Date} endDate - End date of leave
 * @param {Array} holidays - Array of holiday dates (optional)
 * @returns {number} Number of working days
 */
export const calculateWorkingDays = (startDate, endDate, holidays = []) => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) return 0;
  
  let workingDays = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
    const isHoliday = holidays.some(holiday => 
      new Date(holiday).toDateString() === current.toDateString()
    );
    
    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

/**
 * Calculate annual leave entitlement based on employment duration
 * @param {Date} startDate - Employee start date
 * @param {number} annualEntitlement - Base annual leave days (default: 21)
 * @returns {number} Prorated leave entitlement for current year
 */
export const calculateAnnualEntitlement = (startDate, annualEntitlement = 21) => {
  if (!startDate) return 0;
  
  const start = new Date(startDate);
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);
  
  // If started before current year, return full entitlement
  if (start.getFullYear() < currentYear) {
    return annualEntitlement;
  }
  
  // If started in current year, prorate based on remaining days
  const totalDaysInYear = (yearEnd - yearStart) / (1000 * 60 * 60 * 24) + 1;
  const remainingDaysInYear = (yearEnd - start) / (1000 * 60 * 60 * 24) + 1;
  
  return Math.floor((remainingDaysInYear / totalDaysInYear) * annualEntitlement);
};

/**
 * Calculate remaining leave balance
 * @param {number} entitlement - Total leave entitlement
 * @param {number} usedDays - Days already taken
 * @param {number} pendingDays - Days in pending requests
 * @returns {Object} Leave balance breakdown
 */
export const calculateLeaveBalance = (entitlement, usedDays = 0, pendingDays = 0) => {
  const remaining = entitlement - usedDays;
  const available = remaining - pendingDays;
  
  return {
    entitlement,
    used: usedDays,
    pending: pendingDays,
    remaining,
    available: Math.max(0, available)
  };
};

/**
 * Check if leave request is valid based on available balance
 * @param {number} requestedDays - Number of days requested
 * @param {Object} leaveBalance - Current leave balance
 * @returns {Object} Validation result
 */
export const validateLeaveRequest = (requestedDays, leaveBalance) => {
  const { available } = leaveBalance;
  
  if (requestedDays <= 0) {
    return {
      isValid: false,
      message: 'Leave request must be for at least 1 day'
    };
  }
  
  if (requestedDays > available) {
    return {
      isValid: false,
      message: `Insufficient leave balance. Available: ${available} days, Requested: ${requestedDays} days`
    };
  }
  
  return {
    isValid: true,
    message: 'Leave request is valid'
  };
};

/**
 * Calculate leave accrual for monthly accumulation
 * @param {number} annualEntitlement - Annual leave entitlement
 * @param {Date} employeeStartDate - Employee start date
 * @returns {Object} Monthly accrual information
 */
export const calculateMonthlyAccrual = (annualEntitlement, employeeStartDate) => {
  const monthlyAccrual = annualEntitlement / 12;
  const startDate = new Date(employeeStartDate);
  const currentDate = new Date();
  
  // Calculate months worked
  const monthsWorked = (currentDate.getFullYear() - startDate.getFullYear()) * 12 
    + (currentDate.getMonth() - startDate.getMonth());
  
  const accruedLeave = Math.min(monthsWorked * monthlyAccrual, annualEntitlement);
  
  return {
    monthlyAccrual: Math.round(monthlyAccrual * 100) / 100,
    monthsWorked,
    accruedLeave: Math.floor(accruedLeave),
    nextAccrualDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
  };
};

/**
 * Get leave type configurations with default values
 * @returns {Object} Leave type configurations
 */
export const getLeaveTypeConfigs = () => {
  return {
    annual: {
      name: 'Annual Leave',
      defaultEntitlement: 21,
      carryOver: true,
      maxCarryOver: 5,
      requiresApproval: true
    },
    sick: {
      name: 'Sick Leave',
      defaultEntitlement: 10,
      carryOver: false,
      maxCarryOver: 0,
      requiresApproval: false
    },
    personal: {
      name: 'Personal Leave',
      defaultEntitlement: 3,
      carryOver: false,
      maxCarryOver: 0,
      requiresApproval: true
    },
    maternity: {
      name: 'Maternity/Paternity Leave',
      defaultEntitlement: 90,
      carryOver: false,
      maxCarryOver: 0,
      requiresApproval: true
    },
    emergency: {
      name: 'Emergency Leave',
      defaultEntitlement: 2,
      carryOver: false,
      maxCarryOver: 0,
      requiresApproval: true
    }
  };
};

/**
 * Calculate carry over leave from previous year
 * @param {number} previousYearRemaining - Remaining leave from previous year
 * @param {string} leaveType - Type of leave
 * @returns {number} Carry over amount
 */
export const calculateCarryOver = (previousYearRemaining, leaveType) => {
  const config = getLeaveTypeConfigs()[leaveType];
  
  if (!config || !config.carryOver) {
    return 0;
  }
  
  return Math.min(previousYearRemaining, config.maxCarryOver);
};

/**
 * Format leave duration for display
 * @param {number} days - Number of days
 * @returns {string} Formatted duration string
 */
export const formatLeaveDuration = (days) => {
  if (days === 0) return '0 days';
  if (days === 1) return '1 day';
  if (days < 1) return `${days} day`;
  return `${days} days`;
};

/**
 * Calculate leave statistics for reporting
 * @param {Array} employees - Array of employee objects with leave data
 * @returns {Object} Leave statistics
 */
export const calculateLeaveStatistics = (employees) => {
  if (!employees || employees.length === 0) {
    return {
      totalEmployees: 0,
      averageLeaveUsage: 0,
      totalLeaveTaken: 0,
      totalPendingRequests: 0,
      leaveUtilizationRate: 0
    };
  }
  
  const stats = employees.reduce((acc, employee) => {
    const leaveData = employee.leaveBalance || {};
    acc.totalLeaveTaken += leaveData.used || 0;
    acc.totalPendingRequests += leaveData.pending || 0;
    acc.totalEntitlement += leaveData.entitlement || 0;
    return acc;
  }, {
    totalLeaveTaken: 0,
    totalPendingRequests: 0,
    totalEntitlement: 0
  });
  
  const averageLeaveUsage = stats.totalLeaveTaken / employees.length;
  const leaveUtilizationRate = stats.totalEntitlement > 0 
    ? (stats.totalLeaveTaken / stats.totalEntitlement) * 100 
    : 0;
  
  return {
    totalEmployees: employees.length,
    averageLeaveUsage: Math.round(averageLeaveUsage * 100) / 100,
    totalLeaveTaken: stats.totalLeaveTaken,
    totalPendingRequests: stats.totalPendingRequests,
    leaveUtilizationRate: Math.round(leaveUtilizationRate * 100) / 100
  };
};