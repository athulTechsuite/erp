import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AnnouncementsManagement from './components/AnnouncementsManagement';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Services
import { authService } from './services/authService';

// Styles
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated on app load
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {user && <Navbar user={user} onLogout={handleLogout} />}
        
        <main className={user ? 'main-content' : 'main-content-full'}>
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
              } 
            />
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute user={user}>
                  <Dashboard user={user} />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/announcements/manage" 
              element={
                <ProtectedRoute user={user} requiredRole="admin">
                  <AnnouncementsManagement user={user} />
                </ProtectedRoute>
              } 
            />
            
            {/* Default redirect */}
            <Route 
              path="/" 
              element={
                <Navigate to={user ? "/dashboard" : "/login"} />
              } 
            />
            
            {/* Catch all - redirect to dashboard or login */}
            <Route 
              path="*" 
              element={
                <Navigate to={user ? "/dashboard" : "/login"} />
              } 
            />
          </Routes>
        </main>
        
        {/* Toast notifications */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

export default App;