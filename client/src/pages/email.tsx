import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'wouter';
import { Mail } from 'lucide-react';
import EmailClient from '@/components/email/email-client';
import { AppHeader } from '@/components/shared/app-header';

export default function EmailPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-gray-50">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full" />
            <Mail className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
          </div>
          <p className="mt-4 text-sm text-gray-600">Loading your inbox...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-screen overflow-hidden">
        <EmailClient />
      </div>
    </div>
  );
}
