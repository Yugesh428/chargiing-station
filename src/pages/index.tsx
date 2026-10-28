import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Lock, Mail, CreditCard, Wallet, BarChart3 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/dashboard');
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        toast({
          title: 'Login Successful',
          description: `Welcome back, ${data.user.fullName}!`,
        });

        router.push('/dashboard');
      } else {
        toast({
          title: 'Login Failed',
          description: data.message || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't show anything while checking
  if (checking) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Login - Zylo EV Charging Management</title>
      </Head>

      <div className="min-h-screen flex">
        {/* Left Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md space-y-8">
            {/* Logo and Title */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center">
                  <Zap className="h-7 w-7 text-white" fill="white" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-slate-900">Zylo EV</h1>
                  <p className="text-sm text-slate-500">Charging Management</p>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-slate-600">Sign in to manage your charging station</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 h-12 border-slate-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 h-12 border-slate-300 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold text-lg"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">Demo Credentials:</p>
              <div className="text-sm text-blue-800 space-y-1">
                <p><span className="font-medium">Email:</span> lekali_admin@lekali-ev.com</p>
                <p><span className="font-medium">Password:</span> Admin@123</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-slate-500 mt-8">
              <p>© 2026 Zylo EV. All rights reserved.</p>
            </div>
          </div>
        </div>

        {/* Right Side - Image with Text Overlay */}
        <div className="hidden lg:block lg:w-1/2 relative bg-white">
          {/* Background Image - Never Modified */}
          <Image
            src="/EV.png"
            alt="Electric Vehicle"
            fill
            className="object-cover"
            priority
          />
          
          {/* Text and Icons Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50 flex items-center justify-center p-12">
            <div className="text-white space-y-8 max-w-lg">
              {/* Main Heading */}
              <div className="text-center space-y-3">
                <h2 className="text-4xl font-bold drop-shadow-lg">
                  Power Your Future
                </h2>
                <p className="text-lg text-white/90 drop-shadow">
                  Complete EV Charging Station Management
                </p>
              </div>

              {/* Features with Icons */}
              <div className="space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/90 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Session Tracking</h3>
                    <p className="text-sm text-white/80">Monitor all charging sessions with real-time SOC and rates</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/90 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Payment Management</h3>
                    <p className="text-sm text-white/80">Handle Cash, Bank/QR, and Credit payments seamlessly</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/90 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Settlement Tracking</h3>
                    <p className="text-sm text-white/80">Automatic tracking of pending and overdue payments</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/90 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Analytics & Reports</h3>
                    <p className="text-sm text-white/80">Comprehensive reports with revenue insights and trends</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
