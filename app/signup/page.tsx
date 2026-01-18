// j-squared-cinema/app/signup/page.tsx
"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/Header";

function SignUpContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);


  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!name || !email || !password) {
      setError("All fields are required.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        const result = await signIn("credentials", {
            email,
            password,
            redirect: true,
            callbackUrl: "/",
        });
        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
      } else {
        const { error } = await res.json();
        setError(error);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Sign up error:", err);
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#121212] min-h-screen pt-20">
      <Header />
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1a1a2e]/90 to-[#16213e]/80 p-6 shadow-2xl backdrop-blur-lg border border-blue-900/50">
          <h1 className="mb-4 text-center text-3xl font-bold text-white">Sign Up</h1>

        <form onSubmit={handleSignUp} className="space-y-3">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-300">
              Name
            </label>
            <input
              type="text"
              id="name"
              className="w-full rounded-md border border-blue-900/50 bg-[#0f172a]/80 p-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-full rounded-md border border-blue-900/50 bg-[#0f172a]/80 p-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="w-full rounded-md border border-blue-900/50 bg-[#0f172a]/80 p-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none pr-10"
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
          {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-blue-600 p-3 text-lg font-semibold text-white transition duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
          >
            {isLoading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-blue-400 hover:underline">
            Sign In
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">
          By signing up, you agree to our{" "}
          <Link href="/privacy" className="text-blue-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignUpContent />
        </Suspense>
    );
}