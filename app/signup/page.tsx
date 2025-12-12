// j-squared-cinema/app/signup/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignUpContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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
    <div className="flex items-center justify-center bg-signin min-h-screen">
      <div className="w-full max-w-md rounded-2xl bg-blue-950/50 p-8 shadow-2xl backdrop-blur-lg border border-blue-800">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Sign Up</h1>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-300">
              Name
            </label>
            <input
              type="text"
              id="name"
              className="w-full rounded-md border border-blue-800 bg-blue-900/50 p-3 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-full rounded-md border border-blue-800 bg-blue-900/50 p-3 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full rounded-md border border-blue-800 bg-blue-900/50 p-3 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-center text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-indigo-600 p-3 text-lg font-semibold text-white transition duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
          >
            {isLoading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-indigo-400 hover:underline">
            Sign In
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-gray-500">
          By signing up, you agree to our{" "}
          <Link href="/privacy" className="text-indigo-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
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