'use client';

import { useState, useEffect } from 'react';
import { ChatError } from '@/types/chat';

interface ErrorBannerProps {
  error: ChatError;
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (error.retryAfter && error.retryAfter > 0) {
      setCountdown(Math.ceil(error.retryAfter));
    } else {
      setCountdown(null);
    }
  }, [error.retryAfter]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const getErrorIcon = () => {
    switch (error.errorType) {
      case 'rate_limit':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'timeout':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'connection_error':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  const getBgColor = () => {
    if (error.errorType === 'rate_limit') {
      return 'bg-yellow-900/30 border-yellow-800';
    }
    return 'bg-red-900/30 border-red-800';
  };

  const getTextColor = () => {
    if (error.errorType === 'rate_limit') {
      return 'text-yellow-400';
    }
    return 'text-red-400';
  };

  return (
    <div className={`px-4 py-3 border-t ${getBgColor()}`}>
      <div className="flex items-start gap-2">
        <span className={getTextColor()}>{getErrorIcon()}</span>
        <div className="flex-1">
          <p className={`text-sm ${getTextColor()}`}>{error.message}</p>
          {countdown !== null && countdown > 0 && (
            <p className={`text-xs mt-1 ${getTextColor()} opacity-75`}>
              You can retry in {countdown} second{countdown !== 1 ? 's' : ''}
            </p>
          )}
          {error.isRetryable && !countdown && (
            <p className={`text-xs mt-1 ${getTextColor()} opacity-75`}>
              Please try sending your message again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
