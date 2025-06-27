import React, { useState } from 'react';
import { Mail, Lock, User, LogIn, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ParticleBackground from './ParticleBackground';
import { useAuditLog } from '../hooks/useAuditLog';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSliding, setIsSliding] = useState(false);
  
  const { logAction } = useAuditLog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Log signup action
        logAction({
          action: 'user_signup',
          details: {
            email
          }
        });
        
        // Show success message for sign up
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-green-500/50';
        toast.innerHTML = `
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Account created successfully! You can now sign in.
          </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 4000);
        
        // Switch to sign in mode
        setIsSignUp(false);
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Log login action
        logAction({
          action: 'user_login',
          details: {
            email
          }
        });
        
        // Success! Navigate to dashboard
        onAuthSuccess();
        navigate('/dashboard');
      }
    } catch (error: any) {
      setError(error.message);
      
      // Log auth error
      logAction({
        action: isSignUp ? 'user_signup_error' : 'user_login_error',
        details: {
          email,
          error: error.message
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsSliding(true);
    setError(null);
    
    setTimeout(() => {
      setIsSignUp(!isSignUp);
      setPassword('');
      setIsSliding(false);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center px-4">
      {/* Particle Background */}
      <ParticleBackground />
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-cyan-500/10"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-cyan-500/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="relative z-10 w-full max-w-md">
        {/* Main Container with Frosted Glass Effect */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-500/30 overflow-hidden">
          {/* Neon Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>
          
          <div className="relative z-10 p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 
                className="text-4xl font-bold text-white mb-3 font-orbitron tracking-wider"
                style={{
                  textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                }}
              >
                DIREKTOR
              </h1>
              <div className={`transition-all duration-300 transform ${isSliding ? 'translate-x-4 opacity-0' : 'translate-x-0 opacity-100'}`}>
                <p className="text-gray-300 font-jetbrains text-lg">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </p>
                <p className="text-blue-400 font-jetbrains text-sm mt-1">
                  {isSignUp ? 'Join the tournament management revolution' : 'Sign in to manage your tournaments'}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl backdrop-blur-sm">
                <p className="text-red-300 text-sm font-jetbrains">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="relative">
                <label 
                  htmlFor="email" 
                  className={`absolute left-12 transition-all duration-300 font-jetbrains text-sm font-medium pointer-events-none ${
                    email 
                      ? '-top-2 text-blue-400 bg-gray-900 px-2 rounded' 
                      : 'top-4 text-gray-400'
                  }`}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors duration-300" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-gray-800/50 border-2 border-gray-600/50 rounded-xl text-white font-jetbrains focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 backdrop-blur-sm"
                    style={{
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <label 
                  htmlFor="password" 
                  className={`absolute left-12 transition-all duration-300 font-jetbrains text-sm font-medium pointer-events-none ${
                    password 
                      ? '-top-2 text-blue-400 bg-gray-900 px-2 rounded' 
                      : 'top-4 text-gray-400'
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors duration-300" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-4 bg-gray-800/50 border-2 border-gray-600/50 rounded-xl text-white font-jetbrains focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 backdrop-blur-sm"
                    style={{
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-orbitron text-lg tracking-wide relative overflow-hidden group"
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)'
                }}
              >
                {/* Pulsing Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-green-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                    </>
                  ) : (
                    <>
                      {isSignUp ? <User className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                      <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    </>
                  )}
                </div>
              </button>
            </form>

            {/* Toggle Sign Up/Sign In */}
            <div className="mt-8 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600/50"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-900 text-gray-400 font-jetbrains">or</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleToggleMode}
                disabled={loading}
                className="mt-4 text-blue-400 hover:text-blue-300 font-jetbrains transition-all duration-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed relative group"
              >
                <span className={`transition-all duration-300 transform ${isSliding ? 'translate-x-2 opacity-0' : 'translate-x-0 opacity-100'}`}>
                  {isSignUp 
                    ? 'Already have an account? Sign in' 
                    : "New here? Create an account"
                  }
                </span>
                
                {/* Animated underline */}
                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 group-hover:w-full transition-all duration-300"></div>
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-xs font-jetbrains leading-relaxed">
                {isSignUp ? (
                  <>
                    By creating an account, you agree to our terms of service.<br />
                    Start managing professional Scrabble tournaments today.
                  </>
                ) : (
                  <>
                    Secure authentication powered by Supabase.<br />
                    Your tournament data is safe and encrypted.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute -top-4 -left-4 w-8 h-8 bg-blue-500/30 rounded-full blur-sm animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="absolute -top-2 -right-6 w-6 h-6 bg-cyan-500/30 rounded-full blur-sm animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-3 -left-2 w-4 h-4 bg-purple-500/30 rounded-full blur-sm animate-bounce" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-6 -right-4 w-10 h-10 bg-green-500/30 rounded-full blur-sm animate-bounce" style={{ animationDelay: '0.5s' }}></div>
      </div>
    </div>
  );
}