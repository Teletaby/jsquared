// j-squared-cinema/app/signin/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Play, Bookmark, RotateCcw, Sparkles, BarChart3, ChevronLeft } from "lucide-react";

import Header from "@/components/Header";

function SignInContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setCallbackUrl(searchParams.get("callbackUrl") || "/");
  }, [searchParams]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Email and password are required.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result?.ok) {
        setError(result?.error || "Login failed. Please check your credentials.");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("Google sign in error:", err);
      setError("Failed to sign in with Google");
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: 'play',
      color: 'text-blue-400',
      title: "Stream Anywhere",
      description: "Seamless switching across devices"
    },
    {
      icon: 'rotate',
      color: 'text-green-400',
      title: "Continue Watching",
      description: "Resume from where you left off"
    },
    {
      icon: 'bookmark',
      color: 'text-red-400',
      title: "Save Favorites",
      description: "Create watchlists"
    },
    {
      icon: 'chart',
      color: 'text-purple-400',
      title: "Watch History",
      description: "See everything you've watched"
    }
  ];

  const getFeatureIcon = (iconType: string) => {
    switch(iconType) {
      case 'play':
        return <Play size={20} className="text-blue-400" />;
      case 'rotate':
        return <RotateCcw size={20} className="text-green-400" />;
      case 'bookmark':
        return <Bookmark size={20} className="text-red-400" />;
      case 'sparkles':
        return <Sparkles size={20} className="text-yellow-400" />;
      case 'chart':
        return <BarChart3 size={20} className="text-purple-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="relative h-screen pt-16 overflow-hidden">
      {/* Animated Moving Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1a1a2e] to-[#16213e]" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-gradient-to-tl from-blue-500/5 to-transparent rounded-full blur-3xl animate-blob" style={{animationDelay: '2s'}} />
        </div>
      </div>

      <Header />
      
      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center h-[calc(100vh-64px)] overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto px-4 py-2 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Features Section */}
          <div className="hidden lg:block space-y-2">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Unlock Premium Features</h2>
              <p className="text-gray-300 text-sm">Sign in to access all your personalized features</p>
            </div>
            
            <div className="space-y-2">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-700/30 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <div className="flex-shrink-0 pt-0.5\">{getFeatureIcon(feature.icon)}</div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-0.5">{feature.title}</h3>
                    <p className="text-gray-400 text-xs">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sign In Form */}
          <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1a1a2e]/95 to-[#16213e]/90 p-6 shadow-2xl backdrop-blur-xl border border-blue-900/50">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center text-gray-400 hover:text-white mb-3 transition-colors text-sm"
            >
              <ChevronLeft size={18} className="mr-1" />
              Back
            </button>
            <h1 className="mb-4 text-center text-2xl font-bold text-white">Sign In</h1>

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="mb-3 w-full rounded-lg bg-white p-2.5 text-sm text-gray-900 transition duration-200 hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative mb-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-blue-800/50"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#1a1a2e] px-2 text-gray-400 text-xs">Or continue with email</span>
              </div>
            </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-full rounded-lg border border-blue-900/50 bg-[#0f172a]/80 p-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none transition-all"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="w-full rounded-lg border border-blue-900/50 bg-[#0f172a]/80 p-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none pr-9 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          {error && <p className="text-center text-red-500 text-xs\">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-2.5 text-base font-semibold text-white transition duration-200 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400 text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-400 hover:underline font-semibold">
            Sign Up
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">
          By signing in, you agree to our{" "}
          <Link href="/privacy" className="text-blue-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        </div>
      </div>
    </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
      `}</style>
    </div>
  );
}

export default function SigninPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
