import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { getCsrfToken } from '@/lib/csrf';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryClient } from '@tanstack/react-query';

const MAX_EMAIL_LENGTH = 255;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const formSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .max(MAX_EMAIL_LENGTH, `Email must be less than ${MAX_EMAIL_LENGTH} characters`)
      .email('Invalid email address')
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(MAX_PASSWORD_LENGTH, `Password must be less than ${MAX_PASSWORD_LENGTH} characters`)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
      )
      .refine(
        (password) => !/(.)\1{2,}/.test(password),
        'Password cannot contain repeated characters more than twice in a row'
      ),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof formSchema>;

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      // Sanitize the email
      const sanitizedData = {
        email: data.email.toLowerCase().trim(),
        password: data.password,
      };

      // Get CSRF token
      const csrfToken = getCsrfToken();

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // CSRF protection
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include', // Important for handling cookies
        body: JSON.stringify(sanitizedData),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error('This email is already registered. Please try logging in instead.');
        }
        throw new Error(error.message || 'Failed to register');
      }

      // Inform user and redirect to email verification instructions
      toast({
        title: 'Account created! Verify your email',
        description:
          'We sent a verification link to your email. Please verify to enable login. Check spam/junk as well.',
        duration: 6000,
      });

      // Navigate to verification helper page
      window.location.href = '/verify-email';
    } catch (error: any) {
      console.error('Registration error:', error);

      // Handle specific error cases
      const errorMessage = error.message.includes('email')
        ? error.message
        : 'Failed to create account. Please try again or contact support if the problem persists.';

      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: errorMessage,
        duration: 6000,
      });

      // If it's a network error, show a different message
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: 'Please check your internet connection and try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter your email" 
                  autoComplete="email"
                  type="email"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      // Calculate password strength
                      const password = e.target.value;
                      let strength = 0;
                      if (password.length >= 8) strength++;
                      if (/[a-z]/.test(password)) strength++;
                      if (/[A-Z]/.test(password)) strength++;
                      if (/\d/.test(password)) strength++;
                      if (/[@$!%*?&]/.test(password)) strength++;
                      setPasswordStrength(strength);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </FormControl>
              {/* Password strength indicator */}
              <div className="flex items-center space-x-1 mt-1">
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-1 w-4 rounded ${
                        level <= passwordStrength
                          ? passwordStrength <= 2
                            ? 'bg-red-500'
                            : passwordStrength <= 3
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-600">
                  {passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Medium' : 'Strong'}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm">
                  I accept the{' '}
                  <a href="/terms" className="text-blue-600 hover:underline">
                    Terms and Conditions
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <LoadingButton 
          type="submit" 
          className="w-full" 
          loading={isLoading}
          loadingText="Creating account..."
          disabled={passwordStrength < 4}
        >
          <Shield className="w-4 h-4 mr-2" />
          Create Account
        </LoadingButton>
        {passwordStrength < 4 && (
          <p className="text-sm text-amber-600 text-center">
            Please create a stronger password to continue (must meet at least 4 criteria)
          </p>
        )}
        
        <div className="mt-2 text-center text-sm">
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={async () => {
              const email = form.getValues('email').trim();
              if (!email || !/.+@.+\..+/.test(email)) {
                toast({
                  variant: 'destructive',
                  title: 'Invalid email',
                  description: 'Enter your email above first.',
                });
                return;
              }
              try {
                // Get CSRF token
                const csrfToken = getCsrfToken();

                const res = await fetch('/api/auth/resend-verification', {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken || '',
                  },
                  body: JSON.stringify({ email }),
                });
                if (!res.ok) {
                  if (res.status === 429) {
                    const retryAfter = res.headers.get('Retry-After');
                    const seconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
                    toast({
                      variant: 'destructive',
                      title: 'Too many requests',
                      description: `Please try again in ${
                        Number.isFinite(seconds) ? seconds + ' seconds' : 'a few seconds'
                      }.`,
                    });
                    return;
                  }
                  const data = await res
                    .json()
                    .catch(() => ({ message: 'Failed to resend verification email' }));
                  throw new Error(data.message || 'Failed to resend verification email');
                }
                toast({
                  title: 'Verification email sent',
                  description: 'Please check your inbox (and spam/junk folder).',
                });
              } catch (e: any) {
                toast({
                  variant: 'destructive',
                  title: 'Error',
                  description: e.message || 'Failed to resend verification email',
                });
              }
            }}
          >
            Resend verification email
          </button>
        </div>
      </form>
    </Form>
  );
}
