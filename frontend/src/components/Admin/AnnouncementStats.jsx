import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Eye, EyeOff, Users, Calendar, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { formatDate } from '@/utils/dateUtils';

const AnnouncementStats = ({ announcementId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnnouncementStats();
  }, [announcementId]);

  const fetchAnnouncementStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/announcements/${announcementId}/stats`);
      setStats(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch announcement statistics');
      console.error('Error fetching announcement stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'important':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'urgent' || priority === 'important') {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const readPercentage = stats.totalEmployees > 0 
    ? Math.round((stats.readCount / stats.totalEmployees) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Announcement Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Announcement Overview</span>
            <Badge className={getPriorityColor(stats.priority)}>
              <div className="flex items-center gap-1">
                {getPriorityIcon(stats.priority)}
                <span className="capitalize">{stats.priority}</span>
              </div>
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Calendar className="h-5 w-5 text-gray-500 mr-1" />
                <span className="text-sm text-gray-500">Published</span>
              </div>
              <p className="text-lg font-semibold">
                {formatDate(stats.publishedAt)}
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-gray-500 mr-1" />
                <span className="text-sm text-gray-500">Total Employees</span>
              </div>
              <p className="text-lg font-semibold">{stats.totalEmployees}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Eye className="h-5 w-5 text-green-500 mr-1" />
                <span className="text-sm text-gray-500">Read Rate</span>
              </div>
              <p className="text-lg font-semibold text-green-600">
                {readPercentage}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reading Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Reading Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Read Progress</span>
                <span>{stats.readCount} of {stats.totalEmployees}</span>
              </div>
              <Progress value={readPercentage} className="h-3" />
            </div>

            {/* Read/Unread Breakdown */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <Eye className="h-6 w-6 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.readCount}
                </div>
                <div className="text-sm text-green-700">Read</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <EyeOff className="h-6 w-6 text-gray-500" />
                </div>
                <div className="text-2xl font-bold text-gray-600">
                  {stats.unreadCount}
                </div>
                <div className="text-sm text-gray-700">Unread</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Breakdown */}
      {stats.departmentStats && stats.departmentStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Department Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.departmentStats.map((dept, index) => {
                const deptReadPercentage = dept.total > 0 
                  ? Math.round((dept.readCount / dept.total) * 100)
                  : 0;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{dept.name}</span>
                      <span className="text-gray-600">
                        {dept.readCount}/{dept.total} ({deptReadPercentage}%)
                      </span>
                    </div>
                    <Progress value={deptReadPercentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reading Timeline */}
      {stats.readingTimeline && stats.readingTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reading Activity Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.readingTimeline.map((day, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">
                    {formatDate(day.date)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(day.count / Math.max(...stats.readingTimeline.map(d => d.count))) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {day.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnnouncementStats;