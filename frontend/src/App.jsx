import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import AnnouncementsList from './components/Announcements/AnnouncementsList';
import AnnouncementDetail from './components/Announcements/AnnouncementDetail';
import AnnouncementForm from './components/Announcements/AnnouncementForm';
import AdminPanel from './components/Admin/AdminPanel';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// App Routes component
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } 
      />
      
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/announcements" 
        element={
          <ProtectedRoute>
            <Layout>
              <AnnouncementsList />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/announcements/:id" 
        element={
          <ProtectedRoute>
            <Layout>
              <AnnouncementDetail />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute adminOnly={true}>
            <Layout>
              <AdminPanel />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin/announcements/new" 
        element={
          <ProtectedRoute adminOnly={true}>
            <Layout>
              <AnnouncementForm />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin/announcements/:id/edit" 
        element={
          <ProtectedRoute adminOnly={true}>
            <Layout>
              <AnnouncementForm />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App component
function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;