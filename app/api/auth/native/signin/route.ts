// app/api/auth/native/signin/route.ts
import { NextResponse } from "next/server";
import { nativeAuthApi } from "@/lib/native-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, otp, continuationToken } = body;

    if (action === "send-otp") {
      // Step 1: Initiate sign-in
      const startData = await nativeAuthApi.signInStart(email);

      if (startData.error) {
        throw new Error(startData.error_description || startData.error);
      }

      // Step 2: Request OTP challenge (this triggers the email)
      const challengeData = await nativeAuthApi.signInChallenge(startData.continuation_token);

      if (challengeData.error) {
        throw new Error(challengeData.error_description || challengeData.error);
      }

      return NextResponse.json({
        success: true,
        message: "OTP sent",
        continuationToken: challengeData.continuation_token,
      });
    }

    if (action === "verify-otp") {
      // Step 3: Verify OTP to get tokens
      const data = await nativeAuthApi.signInToken(continuationToken, otp);

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      const response = NextResponse.json({
        success: true,
        token: data.access_token,
        idToken: data.id_token,
      });

      // Set auth cookie so middleware allows access to protected routes
      response.cookies.set("isAuthenticated", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return response;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Native signin error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
