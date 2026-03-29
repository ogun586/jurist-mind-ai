import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { supabase } from '@/integrations/supabase/client';

export function ChatAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const { user, profile, signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  // Redirect based on onboarding state
  if (user) {
    if (profile?.onboarding_completed) return <Navigate to="/" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  const sendVerificationCode = async () => {
    const { data, error } = await supabase.functions.invoke('send-verification-code', {
      body: {
        email,
        userData: { email, password, displayName, phone, userType },
      },
    });
    if (error) throw new Error(error.message || 'Failed to send verification code');
    if (data?.error) throw new Error(data.error);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({ title: 'Sign In Error', description: error.message, variant: 'destructive' });
        }
      } else {
        // Send verification code instead of creating user directly
        await sendVerificationCode();
        setShowVerification(true);
        toast({
          title: 'Verification Code Sent',
          description: `We've sent a 6-digit code to ${email}. Check your inbox.`,
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) return;
    setVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-email-code', {
        body: { email, code: verificationCode },
      });

      if (error || data?.error) {
        toast({
          title: 'Verification Failed',
          description: data?.error || error?.message || 'Invalid or expired code. Please try again.',
          variant: 'destructive',
        });
        setVerifying(false);
        return;
      }

      toast({ title: 'Email Verified!', description: 'Welcome to Jurist Mind. Setting up your account...' });

      // Auto sign-in after successful verification
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        toast({
          title: 'Sign In Error',
          description: 'Account created but auto sign-in failed. Please sign in manually.',
          variant: 'destructive',
        });
        setShowVerification(false);
        setIsLogin(true);
      }
      // AuthContext will handle redirect to /onboarding
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Verification failed.', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      await sendVerificationCode();
      toast({ title: 'Code Resent', description: `A new code has been sent to ${email}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to resend code.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({ title: 'Google Sign In Error', description: error.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred with Google sign in.', variant: 'destructive' });
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── Verification Code Screen ────────────────────────────────────
  if (showVerification) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
              <p className="text-muted-foreground text-sm">
                We sent a 6-digit verification code to
              </p>
              <p className="text-foreground font-medium text-sm mt-1">{email}</p>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={setVerificationCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-14 text-lg border-border" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-lg border-border" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-lg border-border" />
                  <InputOTPSlot index={3} className="w-12 h-14 text-lg border-border" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-lg border-border" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-lg border-border" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerifyCode}
              disabled={verificationCode.length !== 6 || verifying}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-semibold"
            >
              {verifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              ) : (
                'Verify & Continue'
              )}
            </Button>

            <div className="text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                Didn't receive the code?{' '}
                <Button
                  variant="link"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-primary p-0 h-auto font-medium"
                >
                  {resending ? 'Resending...' : 'Resend code'}
                </Button>
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowVerification(false);
                  setVerificationCode('');
                }}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to sign up
              </Button>
            </div>

            <p className="text-center text-muted-foreground text-xs">
              The code expires in 10 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Login / Signup Form ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-1 tracking-tight">JURIST MIND</h1>
            <p className="text-muted-foreground text-sm">
              {isLogin ? 'Welcome back. Sign in to continue.' : 'Create your account to get started.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Sign up extra fields */}
            {!isLogin && (
              <>
                {/* Full Name */}
                <div className="rounded-xl border border-border bg-card/50 px-4 py-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Full Name</label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Adebayo Okafor"
                    className="h-9 bg-transparent border-none p-0 text-sm focus-visible:ring-0"
                    required={!isLogin}
                  />
                </div>

                {/* Phone */}
                <div className="rounded-xl border border-border bg-card/50 px-4 py-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Phone Number</label>
                  <PhoneInput
                    international
                    defaultCountry="NG"
                    value={phone}
                    onChange={(value) => setPhone(value || '')}
                    className="phone-input-wrapper"
                  />
                </div>

                {/* User Type */}
                <div className="rounded-xl border border-border bg-card/50 px-4 py-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">I am a...</label>
                  <Select value={userType} onValueChange={setUserType}>
                    <SelectTrigger className="h-9 bg-transparent border-none p-0 text-sm focus:ring-0 shadow-none">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lawyer">Lawyer</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="researcher">Researcher</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Email */}
            <div className="rounded-xl border border-border bg-card/50 px-4 py-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-9 bg-transparent border-none p-0 text-sm focus-visible:ring-0"
                required
              />
            </div>

            {/* Password */}
            <div className="rounded-xl border border-border bg-card/50 px-4 py-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 bg-transparent border-none p-0 text-sm focus-visible:ring-0"
                required
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full bg-foreground text-background hover:bg-foreground/90 h-12 rounded-xl font-semibold"
              disabled={loading || (!isLogin && (!displayName || !email || !password))}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isLogin ? 'Signing in...' : 'Sending verification code...'}</>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-12 rounded-xl"
            >
              {googleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </Button>
          </form>

          {/* Toggle login/signup */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
