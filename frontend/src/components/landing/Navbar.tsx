'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-surface-300/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">
              chat.porygonlabs.dev
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-surface-700 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-surface-700 hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="https://github.com/porygonlabs/rag-chatbot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-surface-700 hover:text-white transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 text-surface-700 hover:text-white transition-colors"
            >
              Try Demo
            </Link>
            {loading ? (
              <div className="w-20 h-10" />
            ) : isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-primary-400 hover:bg-primary-300 text-white font-medium rounded-lg transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-surface-700 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 bg-primary-400 hover:bg-primary-300 text-white font-medium rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-surface-700 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-surface-300/50">
            <div className="flex flex-col gap-4">
              <Link
                href="#features"
                className="text-surface-700 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-surface-700 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                href="https://github.com/porygonlabs/rag-chatbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-700 hover:text-white transition-colors"
              >
                GitHub
              </Link>
              <Link
                href="/chat"
                className="text-surface-700 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Try Demo
              </Link>
              {!loading && (
                isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 bg-primary-400 hover:bg-primary-300 text-white font-medium rounded-lg transition-colors text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-surface-700 hover:text-white transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/login"
                      className="px-4 py-2 bg-primary-400 hover:bg-primary-300 text-white font-medium rounded-lg transition-colors text-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
