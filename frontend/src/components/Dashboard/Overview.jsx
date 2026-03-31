import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Clock, 
  DollarSign, 
  Package, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  PendingIcon,
  Megaphone,
  Plus,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboardService';
import { announcementService } from '@/services/announcementService';

const Overview = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalEmployees: 0,
      activeLeaveRequests: 0,
      pendingApprovals: 0,
      totalRevenue: 0,
      inventoryItems: 0,
      lowStockItems: 0
    },
    recentLeaveRequests: [],
    upcomingLeaves: [],
    quickActions: [],
    loading: true,
    error: null
  });

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    fetchAnnouncements();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));
      const data = await dashboardService.getOverviewData();
      setDashboardData(prev => ({
        ...prev,
        ...data,
        loading: false,
        error: null
      }));
    } catch (error) {
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load dashboard data'
      }));
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const data = await announcementService.getAnnouncements({ limit: 5 });
      setAnnouncements(data.announcements || []);
      setAnnouncementsError(null);
    } catch (error) {
      setAnnouncementsError('Failed to load announcements');
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await announcementService.deleteAnnouncement(announcementId);
      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
    } catch (error) {
      console.error('Failed to delete announcement:', error);
      alert('Failed to delete announcement. Please try again.');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'destructive';
      case 'pending':
      default:
        return 'warning';
    }
  };

  const StatCard = ({ title, value, icon: Icon, trend, subtitle, alert }) => (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
        {alert && (
          <AlertCircle className="h-4 w-4 text-red-500 absolute top-2 right-8" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <TrendingUp className={`h-3 w-3 mr-1 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const AnnouncementsWidget = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Megaphone className="h-5 w-5 mr-2" />
          Company Announcements
        </CardTitle>
        {user?.role === 'admin' && (
          <Button size="sm" variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {announcementsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : announcementsError ? (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{announcementsError}</p>
            <Button size="sm" variant="outline" onClick={fetchAnnouncements} className="mt-2">
              Retry
            </Button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8">
            <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No announcements yet</p>
            {user?.role === 'admin' && (
              <p className="text-xs text-muted-foreground">
                Be the first to create an announcement for your team
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-1">{announcement.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>By {announcement.author?.firstName} {announcement.author?.lastName}</span>
                      <span>•</span>
                      <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                      {announcement.createdAt !== announcement.updatedAt && (
                        <>
                          <span>•</span>
                          <span className="italic">Updated</span>
                        </>
                      )}
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {announcements.length >= 5 && (
              <div className="pt-2 border-t">
                <Button variant="outline" size="sm" className="w-full">
                  View All Announcements
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (dashboardData.loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-8 bg-gray-300 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (dashboardData.error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
          <p className="text-muted-foreground mb-4">{dashboardData.error}</p>
          <Button onClick={fetchDashboardData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName || 'User'}! Here's what's happening in your company.
          </p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline" size="sm">
          Refresh Data
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Employees"
          value={dashboardData.stats.totalEmployees}
          icon={Users}
          trend={5}
        />
        <StatCard
          title="Active Leaves"
          value={dashboardData.stats.activeLeaveRequests}
          icon={Calendar}
          subtitle="Currently on leave"
        />
        <StatCard
          title="Pending Approvals"
          value={dashboardData.stats.pendingApprovals}
          icon={Clock}
          alert={dashboardData.stats.pendingApprovals > 0}
          subtitle="Require attention"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${dashboardData.stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={12}
        />
        <StatCard
          title="Inventory Items"
          value={dashboardData.stats.inventoryItems}
          icon={Package}
          subtitle="Total items"
        />
        <StatCard
          title="Low Stock Items"
          value={dashboardData.stats.lowStockItems}
          icon={AlertCircle}
          alert={dashboardData.stats.lowStockItems > 0}
          subtitle="Need restocking"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company Announcements */}
        <AnnouncementsWidget />

        {/* Recent Leave Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.recentLeaveRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No recent leave requests
                </p>
              ) : (
                dashboardData.recentLeaveRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {request.employee.firstName?.[0] || 'N'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {request.employee.firstName} {request.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.leaveType} - {request.days} day{request.days !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(request.status)}
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
            {dashboardData.recentLeaveRequests.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" className="w-full" size="sm">
                  View All Requests
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Leaves */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.upcomingLeaves.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No upcoming leaves
                </p>
              ) : (
                dashboardData.upcomingLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-green-600">
                          {leave.employee.firstName?.[0] || 'N'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {leave.employee.firstName} {leave.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leave.leaveType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Starts {new Date(leave.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {leave.days} day{leave.days !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.ceil((new Date(leave.startDate) - new Date()) / (1000 * 60 * 60 * 24))} days away
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {user?.role === 'admin' || user?.role === 'manager' ? (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button className="justify-start" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
              <Button className="justify-start" variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                View Calendar
              </Button>
              <Button className="justify-start" variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Manage Inventory
              </Button>
              <Button className="justify-start" variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Financial Reports
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* System Alerts */}
      {(dashboardData.stats.pendingApprovals > 0 || dashboardData.stats.lowStockItems > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.stats.pendingApprovals > 0 && (
                <div className="flex items-center text-sm text-yellow-800">
                  <Clock className="h-4 w-4 mr-2" />
                  {dashboardData.stats.pendingApprovals} leave request{dashboardData.stats.pendingApprovals !== 1 ? 's' : ''} pending approval
                </div>
              )}
              {dashboardData.stats.lowStockItems > 0 && (
                <div className="flex items-center text-sm text-yellow-800">
                  <Package className="h-4 w-4 mr-2" />
                  {dashboardData.stats.lowStockItems} inventory item{dashboardData.stats.lowStockItems !== 1 ? 's' : ''} running low on stock
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Overview;