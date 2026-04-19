import React, { Suspense } from 'react';
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

// Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading component
const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>Loading...</p>
  </div>
);

// Route wrapper with error boundary and loading state
const RouteWrapper = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return (
    <RouteWrapper>
      {children}
    </RouteWrapper>
  );
};

// App Routes component
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <RouteWrapper>
            {isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          </RouteWrapper>
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
      
      <Route 
        path="*" 
        element={
          <RouteWrapper>
            <Navigate to="/" replace />
          </RouteWrapper>
        } 
      />
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
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;