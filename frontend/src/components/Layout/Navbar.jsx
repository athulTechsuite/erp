import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  EventNote as LeaveIcon,
  Assessment as ReportsIcon,
  Inventory as InventoryIcon,
  AccountBalance as FinanceIcon,
  AccountCircle as AccountIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  Badge,
  Announcement as AnnouncementIcon
} from '@mui/icons-material';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  const handleNotificationClick = (notificationId) => {
    markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    handleNotificationsClose();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <AnnouncementIcon fontSize="small" color="primary" />;
      case 'leave':
        return <LeaveIcon fontSize="small" color="secondary" />;
      case 'system':
        return <SettingsIcon fontSize="small" color="action" />;
      default:
        return <NotificationsIcon fontSize="small" />;
    }
  };

  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const navigationItems = [
    { title: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: ['admin', 'employee'] },
    { title: 'Employees', path: '/employees', icon: <PeopleIcon />, roles: ['admin'] },
    { title: 'Leave Management', path: '/leave', icon: <LeaveIcon />, roles: ['admin', 'employee'] },
    { title: 'Reports', path: '/reports', icon: <ReportsIcon />, roles: ['admin'] },
    { title: 'Inventory', path: '/inventory', icon: <InventoryIcon />, roles: ['admin'] },
    { title: 'Finance', path: '/finance', icon: <FinanceIcon />, roles: ['admin'] }
  ];

  // Add Company Announcements to navigation for admins
  if (user?.role?.toLowerCase() === 'admin') {
    navigationItems.push({
      title: 'Announcements',
      path: '/announcements',
      icon: <AnnouncementIcon />,
      roles: ['admin']
    });
  }

  const filteredNavItems = navigationItems.filter(item => 
    item.roles.includes(user?.role?.toLowerCase())
  );

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const NavLinks = ({ mobile = false }) => (
    <>
      {filteredNavItems.map((item) => (
        mobile ? (
          <ListItem
            button
            key={item.title}
            component={Link}
            to={item.path}
            selected={isActiveRoute(item.path)}
            onClick={() => mobile && setMobileDrawerOpen(false)}
          >
            <ListItemIcon sx={{ color: isActiveRoute(item.path) ? 'primary.main' : 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItem>
        ) : (
          <Button
            key={item.title}
            component={Link}
            to={item.path}
            color="inherit"
            startIcon={item.icon}
            sx={{
              mx: 1,
              backgroundColor: isActiveRoute(item.path) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {item.title}
          </Button>
        )
      ))}
    </>
  );

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          {user?.firstName?.charAt(0) || user?.email?.charAt(0)}
        </Avatar>
        <Box>
          <Typography variant="subtitle1" noWrap>
            {user?.firstName} {user?.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {user?.role}
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List>
        <NavLinks mobile />
      </List>
      <Divider />
      <List>
        <ListItem button component={Link} to="/profile" onClick={() => setMobileDrawerOpen(false)}>
          <ListItemIcon>
            <AccountIcon />
          </ListItemIcon>
          <ListItemText primary="Profile" />
        </ListItem>
        <ListItem button component={Link} to="/settings" onClick={() => setMobileDrawerOpen(false)}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItem>
        <ListItem button onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
            ERP System
          </Typography>

          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex' }}>
              <NavLinks />
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Notifications */}
            <IconButton
              color="inherit"
              onClick={handleNotificationsOpen}
              aria-label="notifications"
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            {/* User Menu */}
            <IconButton
              onClick={handleUserMenuOpen}
              sx={{ p: 0, ml: 1 }}
            >
              <Avatar sx={{ bgcolor: 'secondary.main' }}>
                {user?.firstName?.charAt(0) || user?.email?.charAt(0)}
              </Avatar>
            </IconButton>

            {!isMobile && (
              <Box sx={{ ml: 1 }}>
                <Typography variant="body2" color="inherit">
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                  {user?.role}
                </Typography>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
        }}
      >
        {drawer}
      </Drawer>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleUserMenuClose}
        onClick={handleUserMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            mt: 1.5,
            minWidth: 180,
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem component={Link} to="/profile">
          <ListItemIcon>
            <AccountIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem component={Link} to="/settings">
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={handleNotificationsClose}
        PaperProps={{
          elevation: 3,
          sx: {
            mt: 1.5,
            minWidth: 350,
            maxHeight: 500,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              Mark all read
            </Button>
          )}
        </Box>
        
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <>
            {notifications.slice(0, 10).map((notification) => (
              <MenuItem
                key={notification._id}
                onClick={() => handleNotificationClick(notification._id)}
                sx={{
                  backgroundColor: notification.read ? 'transparent' : 'action.hover',
                  borderLeft: notification.read ? 'none' : '3px solid',
                  borderLeftColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, width: '100%' }}>
                  {getNotificationIcon(notification.type)}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: notification.read ? 'normal' : 'medium',
                        mb: 0.5
                      }}
                    >
                      {notification.title}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: '0.875rem',
                        lineHeight: 1.4,
                        mb: 0.5
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatNotificationTime(notification.createdAt)}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
            
            {notifications.length > 10 && (
              <>
                <Divider />
                <MenuItem component={Link} to="/notifications" onClick={handleNotificationsClose}>
                  <Typography variant="body2" color="primary" sx={{ textAlign: 'center', width: '100%' }}>
                    View all {notifications.length} notifications
                  </Typography>
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
    </>
  );
};

export default Navbar;