import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { Zap, BarChart3, Wallet, Car, CreditCard, Settings } from 'lucide-react';

export default function Home() {
  const router = useRouter();
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

  // Don't show anything while checking
  if (checking) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Lekali EV Charging Station Management System</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        {/* Navbar */}
        <nav className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" fill="white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Lekali EV</h1>
                  <p className="text-xs text-slate-500">Charging Station Management</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href="/login">
                  <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-slate-900 mb-6">
              EV Charging Station
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-600">
                Management System
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              Complete solution for managing your electric vehicle charging station. 
              Track sessions, manage payments, and handle credit (udaro) settlements effortlessly.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg">
                  Get Started →
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Session Management</h3>
              <p className="text-slate-600">
                Track all charging sessions with detailed information including SOC, rates, and payment status.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Udaro Settlement</h3>
              <p className="text-slate-600">
                Manage credit payments and settlements. Track outstanding amounts and payment history.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Analytics & Reports</h3>
              <p className="text-slate-600">
                Comprehensive analytics with charts, customer segmentation, and revenue insights.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Car className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Vehicle Tracking</h3>
              <p className="text-slate-600">
                Track customer vehicles, visit history, and charging patterns for better service.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Multiple Payment Methods</h3>
              <p className="text-slate-600">
                Support for Cash, Bank/QR, and Credit payments with flexible settlement options.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Settings className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Multi-Tenant Support</h3>
              <p className="text-slate-600">
                Manage multiple charging stations with separate accounts and customizable settings.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-slate-600">
              <p>© 2026 Lekali EV Charging Station Management System</p>
              <p className="text-sm mt-2">Built for efficient charging station operations in Nepal</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
