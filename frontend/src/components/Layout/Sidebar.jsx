import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  HomeIcon, 
  UsersIcon, 
  CalendarIcon, 
  ChartBarIcon,
  CubeIcon,
  CurrencyDollarIcon,
  DocumentReportIcon,
  CogIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
  SpeakerphoneIcon
} from '@heroicons/react/outline';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: HomeIcon,
      roles: ['admin', 'employee']
    },
    {
      name: 'Announcements',
      path: '/announcements',
      icon: SpeakerphoneIcon,
      roles: ['admin', 'employee']
    },
    {
      name: 'Employees',
      path: '/employees',
      icon: UsersIcon,
      roles: ['admin']
    },
    {
      name: 'Leave Management',
      path: '/leave',
      icon: CalendarIcon,
      roles: ['admin', 'employee']
    },
    {
      name: 'My Leave',
      path: '/my-leave',
      icon: CalendarIcon,
      roles: ['employee']
    },
    {
      name: 'Inventory',
      path: '/inventory',
      icon: CubeIcon,
      roles: ['admin']
    },
    {
      name: 'Finance',
      path: '/finance',
      icon: CurrencyDollarIcon,
      roles: ['admin']
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: DocumentReportIcon,
      roles: ['admin']
    },
    {
      name: 'Analytics',
      path: '/analytics',
      icon: ChartBarIcon,
      roles: ['admin']
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: CogIcon,
      roles: ['admin']
    }
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Logo/Brand */}
      <div className={`flex items-center justify-between p-4 border-b border-gray-700 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">ERP</span>
          </div>
          {!isCollapsed && (
            <span className="ml-3 text-lg font-semibold">SmallCorp ERP</span>
          )}
        </div>
        
        {/* Desktop collapse button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:block p-1 rounded-md hover:bg-gray-700 transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden p-1 rounded-md hover:bg-gray-700 transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* User info */}
      <div className={`p-4 border-b border-gray-700 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </span>
          </div>
          {!isCollapsed && (
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.name : ''}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogoutIcon className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex lg:flex-col ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} transition-all duration-300 ease-in-out`}>
        <SidebarContent />
      </div>
    </>
  );
};

export default Sidebar;