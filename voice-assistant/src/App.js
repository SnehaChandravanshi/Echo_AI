import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './App.css';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import VoiceSphere from './VoiceSphere';
import ChatInterface from './ChatInterface';
import Settings from './Settings';
import DeveloperInfo from './DeveloperInfo';
import ErrorBoundary from './ErrorBoundary';
import { TranscriptProvider } from './TranscriptContext';

// Protect routes that require authentication
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/signin" replace />;
};

function App() {
  return (
    <TranscriptProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-glass, rgba(16, 16, 16, 0.9))',
            color: 'var(--text-main, #fff)',
            border: '1px solid var(--border-color, #333)',
            borderRadius: '12px',
            fontSize: '0.9rem',
          },
          success: { iconTheme: { primary: '#6ee7b7', secondary: '#000' } },
          error: { iconTheme: { primary: '#ff6b6b', secondary: '#fff' } },
        }}
      />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<ProtectedRoute><ChatInterface /></ProtectedRoute>} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/voicesphere" element={<ProtectedRoute><VoiceSphere /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/developers" element={<ProtectedRoute><DeveloperInfo /></ProtectedRoute>} />
        </Routes>
      </ErrorBoundary>
    </TranscriptProvider>
  );
}

export default App;
