"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [continuationToken, setContinuationToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    
    try {
      const res = await fetch("/api/auth/native/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-otp", email })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setContinuationToken(data.continuationToken);
        setStep("otp");
      } else {
        setErrorMsg(data.error || "Failed to send OTP");
      }
    } catch (err) {
      setErrorMsg("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    
    try {
      const res = await fetch("/api/auth/native/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-otp", email, otp, continuationToken })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Token logic could be added here before redirect
        window.location.href = "/patientsearch"; 
      } else {
        setErrorMsg(data.error || "Invalid OTP");
      }
    } catch (err) {
      setErrorMsg("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-gray-600">Enter your email to receive a one-time passcode.</p>
        </div>
        
        {errorMsg && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
            {errorMsg}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">One-Time Passcode</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify & Sign In"}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <a href="/auth/signup" className="text-blue-500 hover:underline">
            Don't have an account? Sign up
          </a>
        </div>
      </div>
    </div>
  );
}