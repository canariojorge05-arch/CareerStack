import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, CreditCard as Edit, Download, Users, Star, ArrowRight } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { PageLoader } from '@/components/ui/page-loader';

export default function Landing() {
  const [showCookieNotice, setShowCookieNotice] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Move all useState calls to the top to avoid hooks rule violations
  const [authDialog, setAuthDialog] = useState<'login' | 'register' | 'forgot-password' | null>(
    () => {
      // Check URL parameters first
      const params = new URLSearchParams(window.location.search);
      const authParam = params.get('auth');
      if (authParam === 'login') return 'login';
      if (authParam === 'register') return 'register';

      // Then check path if no auth param
      const path = window.location.pathname;
      if (path === '/login') return 'login';
      if (path === '/register') return 'register';
      return null;
    }
  );

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // Show loading only while checking auth, not during redirect
  if (isLoading) {
    return <PageLoader variant="branded" text="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect border-b border-border sticky top-0 z-50 animate-slide-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="text-white" size={20} />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                ResumeCustomizer Pro
              </h1>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setAuthDialog('login')}
                variant="ghost"
                className="smooth-hover"
                data-testid="button-login"
              >
                Sign In
              </Button>
              <Button
                onClick={() => setAuthDialog('register')}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 smooth-hover shadow-md"
                data-testid="button-register"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Cookie guidance banner */}
      {showCookieNotice && (
        <div className="mx-auto max-w-4xl mt-4 px-4">
          <div className="rounded border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                We noticed repeated session failures. Please ensure your browser allows cookies for
                this site and not blocking them (including in private/incognito mode). After
                enabling cookies, try logging in again.
              </span>
              <button
                type="button"
                className="text-blue-700 underline hover:no-underline"
                onClick={() => {
                  try {
                    localStorage.removeItem('authFailureCount');
                    localStorage.removeItem('authFailureLastAt');
                    localStorage.removeItem('lastActiveTime');
                    sessionStorage.clear();
                    // Clear cookies
                    document.cookie.split(';').forEach((c) => {
                      document.cookie = c
                        .replace(/^ +/, '')
                        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
                    });
                    toast({
                      title: 'Session reset',
                      description: 'Local session data cleared. Please try logging in again.',
                    });
                    setShowCookieNotice(false);
                  } catch (e) {
                    toast({
                      variant: 'destructive',
                      title: 'Reset failed',
                      description: 'Could not clear local session.',
                    });
                  }
                }}
              >
                Reset session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Dialogs */}
      <Dialog open={authDialog === 'login'} onOpenChange={() => setAuthDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Login to your account</DialogTitle>
          </DialogHeader>
          <LoginForm
            onForgotPassword={() => setAuthDialog('forgot-password')}
            onSuccess={() => setAuthDialog(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={authDialog === 'register'} onOpenChange={() => setAuthDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create an account</DialogTitle>
          </DialogHeader>
          <RegisterForm />
        </DialogContent>
      </Dialog>

      <Dialog open={authDialog === 'forgot-password'} onOpenChange={() => setAuthDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
          </DialogHeader>
          <ForgotPasswordForm onBackToLogin={() => setAuthDialog('login')} />
        </DialogContent>
      </Dialog>

      {/* Hero Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 animate-fade-in">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6">
            <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-8">
              Professional Resume Builder
            </span>
          </div>
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-8 tracking-tight">
            Customize Your Resume
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-2">
              AI-Powered Precision
            </span>
          </h2>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Upload your DOCX resume, organize tech skills into strategic groups, and create tailored
            versions for every job application.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 smooth-hover shadow-xl text-lg px-8 py-6 h-auto"
              onClick={() => setAuthDialog('register')}
              data-testid="button-get-started"
            >
              Get Started Free
              <ArrowRight className="ml-2" size={22} />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-4xl font-bold text-center text-foreground mb-16 tracking-tight">
            Everything You Need to Stand Out
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border card-interactive shadow-md">
              <CardContent className="p-8">
                <div className="h-14 w-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-6">
                  <FileText className="text-primary" size={26} />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-3">DOCX Upload & Editing</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Upload your existing resume and edit it with our powerful rich-text editor. Full
                  Microsoft Word compatibility.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border card-interactive shadow-md">
              <CardContent className="p-8">
                <div className="h-14 w-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mb-6">
                  <Edit className="text-accent" size={26} />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-3">
                  Smart Tech Stack Processing
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Organize your technical skills and bullet points into strategic groups for
                  targeted job applications.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border card-interactive shadow-md">
              <CardContent className="p-8">
                <div className="h-14 w-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center mb-6">
                  <Download className="text-orange-600" size={26} />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-3">Export & Cloud Storage</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Download as DOCX/PDF or save directly to Google Drive. Access your resumes
                  anywhere.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">How It Works</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">1</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Upload Resume</h4>
              <p className="text-muted-foreground">Upload your DOCX resume files</p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">2</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Add Tech Stacks</h4>
              <p className="text-muted-foreground">Input your technical skills and bullet points</p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">3</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Generate Groups</h4>
              <p className="text-muted-foreground">AI organizes points into strategic groups</p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">4</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Customize & Export</h4>
              <p className="text-muted-foreground">Edit and download your tailored resume</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary to-accent">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl font-bold text-white mb-6 tracking-tight">
            Ready to Create Your Perfect Resume?
          </h3>
          <p className="text-xl text-white/90 mb-10">
            Join thousands of professionals who've landed their dream jobs with our platform.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => (window.location.href = '/login')}
            className="bg-white text-primary hover:bg-white/95 smooth-hover shadow-xl text-lg px-8 py-6 h-auto font-semibold"
            data-testid="button-start-now"
          >
            Start Customizing Now
            <ArrowRight className="ml-2" size={22} />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="text-primary-foreground" size={16} />
            </div>
            <span className="text-lg font-semibold text-foreground">ResumeCustomizer Pro</span>
          </div>
          <p className="text-muted-foreground">© 2024 ResumeCustomizer Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
