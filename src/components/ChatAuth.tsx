import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export function ChatAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { user, profile, signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  // Redirect based on onboarding state
  if (user) {
    if (profile?.onboarding_completed) return <Navigate to="/" replace />;
    return <Navigate to="/onboarding" replace />;
  }

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
        const { error } = await signUp(email, password, displayName, phone, userType);
        if (error) {
          toast({ title: 'Sign Up Error', description: error.message, variant: 'destructive' });
        } else {
          toast({
            title: 'Account Created!',
            description: 'Welcome to Jurist Mind. Let\'s set up your profile.',
          });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isLogin ? 'Signing in...' : 'Creating account...'}</>
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
