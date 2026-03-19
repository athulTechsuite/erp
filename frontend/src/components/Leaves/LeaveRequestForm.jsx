import React, { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Send, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services/leaveService';
import { employeeService } from '../../services/employeeService';

const LeaveRequestForm = ({ onSubmitSuccess, onCancel }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    employeeId: user?.employeeId || '',
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    isHalfDay: false,
    halfDayPeriod: 'morning'
  });
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [calculatedDays, setCalculatedDays] = useState(0);

  const leaveTypes = [
    { value: 'annual', label: 'Annual Leave', color: 'bg-blue-100 text-blue-800' },
    { value: 'sick', label: 'Sick Leave', color: 'bg-red-100 text-red-800' },
    { value: 'personal', label: 'Personal Leave', color: 'bg-purple-100 text-purple-800' },
    { value: 'emergency', label: 'Emergency Leave', color: 'bg-orange-100 text-orange-800' },
    { value: 'maternity', label: 'Maternity Leave', color: 'bg-pink-100 text-pink-800' },
    { value: 'paternity', label: 'Paternity Leave', color: 'bg-green-100 text-green-800' }
  ];

  useEffect(() => {
    if (user?.employeeId) {
      fetchLeaveBalance();
    }
  }, [user]);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      calculateLeaveDays();
    }
  }, [formData.startDate, formData.endDate, formData.isHalfDay]);

  const fetchLeaveBalance = async () => {
    try {
      const balance = await employeeService.getLeaveBalance(user.employeeId);
      setLeaveBalance(balance);
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const calculateLeaveDays = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    if (start <= end) {
      const timeDiff = end.getTime() - start.getTime();
      let daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      
      // Exclude weekends
      let workingDays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0 && d.getDay() !== 6) { // Not Sunday (0) or Saturday (6)
          workingDays++;
        }
      }
      
      if (formData.isHalfDay && workingDays === 1) {
        setCalculatedDays(0.5);
      } else {
        setCalculatedDays(workingDays);
      }
    } else {
      setCalculatedDays(0);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.leaveType) {
      newErrors.leaveType = 'Please select a leave type';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (start < today) {
        newErrors.startDate = 'Start date cannot be in the past';
      }

      if (end < start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason for your leave request';
    } else if (formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters long';
    }

    // Check leave balance
    if (formData.leaveType && leaveBalance) {
      const availableBalance = leaveBalance[formData.leaveType] || 0;
      if (calculatedDays > availableBalance) {
        newErrors.balance = `Insufficient leave balance. Available: ${availableBalance} days, Requested: ${calculatedDays} days`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const leaveRequest = {
        ...formData,
        daysRequested: calculatedDays,
        status: 'pending',
        submittedAt: new Date().toISOString()
      };

      await leaveService.submitLeaveRequest(leaveRequest);
      
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      setErrors({
        submit: 'Failed to submit leave request. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLeaveTypeColor = (type) => {
    const leaveType = leaveTypes.find(lt => lt.value === type);
    return leaveType ? leaveType.color : 'bg-gray-100 text-gray-800';
  };

  const getAvailableBalance = (type) => {
    if (!leaveBalance || !type) return 0;
    return leaveBalance[type] || 0;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <FileText className="w-6 h-6 mr-2 text-blue-600" />
          Request Leave
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Leave Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Leave Type *
          </label>
          <select
            name="leaveType"
            value={formData.leaveType}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.leaveType ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select leave type...</option>
            {leaveTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.leaveType && (
            <p className="text-red-500 text-sm mt-1 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.leaveType}
            </p>
          )}
          
          {/* Leave Balance Display */}
          {formData.leaveType && leaveBalance && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Available Balance:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getLeaveTypeColor(formData.leaveType)}`}>
                  {getAvailableBalance(formData.leaveType)} days
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <div className="relative">
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.startDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            {errors.startDate && (
              <p className="text-red-500 text-sm mt-1 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.startDate}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date *
            </label>
            <div className="relative">
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                min={formData.startDate || new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.endDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            {errors.endDate && (
              <p className="text-red-500 text-sm mt-1 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.endDate}
              </p>
            )}
          </div>
        </div>

        {/* Half Day Option */}
        {calculatedDays === 1 && (
          <div className="p-4 bg-blue-50 rounded-md">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="isHalfDay"
                name="isHalfDay"
                checked={formData.isHalfDay}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isHalfDay" className="ml-2 text-sm font-medium text-gray-700">
                Half Day Leave
              </label>
            </div>
            
            {formData.isHalfDay && (
              <div className="ml-6">
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      value="morning"
                      checked={formData.halfDayPeriod === 'morning'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Morning</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="halfDayPeriod"
                      value="afternoon"
                      checked={formData.halfDayPeriod === 'afternoon'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Afternoon</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Days Calculation Display */}
        {calculatedDays > 0 && (
          <div className="p-3 bg-green-50 rounded-md">
            <div className="flex items-center">
              <Clock className="w-4 h-4 text-green-600 mr-2" />
              <span className="text-sm text-green-800">
                Total working days: <strong>{calculatedDays}</strong> 
                {calculatedDays === 0.5 ? ' (Half Day)' : calculatedDays === 1 ? ' day' : ' days'}
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason *
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            rows={4}
            placeholder="Please provide a detailed reason for your leave request..."
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              errors.reason ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            {errors.reason && (
              <p className="text-red-500 text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.reason}
              </p>
            )}
            <span className="text-xs text-gray-500 ml-auto">
              {formData.reason.length}/500
            </span>
          </div>
        </div>

        {/* Balance Error */}
        {errors.balance && (
          <div className="p-3 bg-red-50 rounded-md">
            <p className="text-red-700 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {errors.balance}
            </p>
          </div>
        )}

        {/* Submit Error */}
        {errors.submit && (
          <div className="p-3 bg-red-50 rounded-md">
            <p className="text-red-700 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {errors.submit}
            </p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex space-x-4 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || calculatedDays === 0}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;