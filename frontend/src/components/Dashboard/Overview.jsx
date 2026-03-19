import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  Send,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboardService';
import { announcementsService } from '@/services/announcementsService';

const AnnouncementWidget = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    expirationDate: ''
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecentAnnouncements();
  }, []);

  const fetchRecentAnnouncements = async () => {
    try {
      const announcements = await announcementsService.getActive();
      setRecentAnnouncements(announcements.slice(0, 3)); // Show only 3 most recent
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      setError('Title and content are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await announcementsService.create({
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        expirationDate: newAnnouncement.expirationDate || null
      });
      
      setNewAnnouncement({ title: '', content: '', expirationDate: '' });
      setIsCreateDialogOpen(false);
      fetchRecentAnnouncements();
    } catch (error) {
      setError('Failed to create announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isExpiringSoon = (expirationDate) => {
    if (!expirationDate) return false;
    const expiry = new Date(expirationDate);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return expiry <= threeDaysFromNow;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Megaphone className="h-5 w-5 mr-2" />
            Company Announcements
          </CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Create Company Announcement</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAnnouncement}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter announcement title..."
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <Textarea
                      id="content"
                      placeholder="Enter announcement content..."
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full min-h-[100px] resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expirationDate" className="flex items-center">
                      <CalendarDays className="h-4 w-4 mr-1" />
                      Expiration Date (Optional)
                    </Label>
                    <Input
                      id="expirationDate"
                      type="date"
                      value={newAnnouncement.expirationDate}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, expirationDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full"
                    />
                  </div>
                  {error && (
                    <div className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {error}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setNewAnnouncement({ title: '', content: '', expirationDate: '' });
                      setError(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Publish
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentAnnouncements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active announcements</p>
              <p className="text-xs mt-1">Create your first company announcement above</p>
            </div>
          ) : (
            recentAnnouncements.map((announcement) => (
              <div key={announcement.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm leading-tight pr-2">
                    {announcement.title}
                  </h4>
                  {announcement.expirationDate && isExpiringSoon(announcement.expirationDate) && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5 shrink-0">
                      <Clock className="h-3 w-3 mr-1" />
                      Expiring
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {announcement.content}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Posted {formatDate(announcement.createdAt)}
                  </span>
                  {announcement.expirationDate && (
                    <span className="flex items-center">
                      <CalendarDays className="h-3 w-3 mr-1" />
                      Until {formatDate(announcement.expirationDate)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          
          {recentAnnouncements.length > 0 && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="w-full h-8 text-xs">
                View All Announcements
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

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

  useEffect(() => {
    fetchDashboardData();
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

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        {/* Global Announcements Widget - Only for Admins */}
        {isAdmin && <AnnouncementWidget />}
      </div>

      {/* Quick Actions */}
      {isAdmin ? (
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