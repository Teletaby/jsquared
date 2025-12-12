// j-squared-cinema/app/signin/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignInContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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



  return (
    <div className="flex items-center justify-center bg-signin min-h-screen">
      <div className="w-full max-w-md rounded-2xl bg-blue-950/50 p-8 shadow-2xl backdrop-blur-lg border border-blue-800">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Sign In</h1>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="mb-4 w-full rounded-md border border-blue-700 bg-blue-800/50 p-3 text-white transition duration-200 hover:bg-blue-700 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-blue-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-blue-950/50 px-2 text-gray-400">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
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
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-400">
          Don't have an account?{" "}
          <Link href="/signup" className="text-indigo-400 hover:underline">
            Sign Up
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-gray-500">
          By signing in, you agree to our{" "}
          <Link href="/privacy" className="text-indigo-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
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
