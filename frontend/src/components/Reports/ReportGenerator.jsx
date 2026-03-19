import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { Download, FileText, Users, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ReportGenerator = () => {
  const [reportType, setReportType] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date()
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  const reportTypes = [
    { value: 'leave_summary', label: 'Leave Summary Report', icon: Calendar },
    { value: 'employee_attendance', label: 'Employee Attendance Report', icon: Users },
    { value: 'leave_balance', label: 'Leave Balance Report', icon: FileText },
    { value: 'department_overview', label: 'Department Overview', icon: TrendingUp }
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const generateReport = async () => {
    if (!reportType) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/reports/${reportType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!reportData) return;

    const ws = XLSX.utils.json_to_sheet(reportData.data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportData.title);
    
    const fileName = `${reportData.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportToPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(reportData.title, 20, 20);
    
    // Add date range
    doc.setFontSize(10);
    doc.text(
      `Period: ${format(dateRange.startDate, 'MMM dd, yyyy')} - ${format(dateRange.endDate, 'MMM dd, yyyy')}`,
      20,
      30
    );

    // Add table
    if (reportData.data && reportData.data.length > 0) {
      const columns = Object.keys(reportData.data[0]);
      const rows = reportData.data.map(item => columns.map(col => item[col]));

      doc.autoTable({
        head: [columns],
        body: rows,
        startY: 40,
        styles: { fontSize: 8 }
      });
    }

    const fileName = `${reportData.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  };

  const renderReportPreview = () => {
    if (!reportData) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {reportData.title}
            <div className="flex gap-2">
              <Button onClick={exportToExcel} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button onClick={exportToPDF} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 mb-4">
            Period: {format(dateRange.startDate, 'MMM dd, yyyy')} - {format(dateRange.endDate, 'MMM dd, yyyy')}
          </div>
          
          {reportData.summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(reportData.summary).map(([key, value]) => (
                <div key={key} className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 capitalize">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  {reportData.data && reportData.data.length > 0 &&
                    Object.keys(reportData.data[0]).map(column => (
                      <th key={column} className="border border-gray-200 px-4 py-2 text-left">
                        {column.replace(/_/g, ' ').toUpperCase()}
                      </th>
                    ))
                  }
                </tr>
              </thead>
              <tbody>
                {reportData.data?.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex} className="border border-gray-200 px-4 py-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Report Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Report Type
              </label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(type => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Start Date
              </label>
              <DatePicker
                selected={dateRange.startDate}
                onChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
                selectsStart
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                End Date
              </label>
              <DatePicker
                selected={dateRange.endDate}
                onChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
                selectsEnd
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                minDate={dateRange.startDate}
              />
            </div>
          </div>

          <Button 
            onClick={generateReport} 
            disabled={!reportType || loading}
            className="w-full md:w-auto"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </CardContent>
      </Card>

      {renderReportPreview()}
    </div>
  );
};

export default ReportGenerator;