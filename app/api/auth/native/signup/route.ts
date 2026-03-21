// app/api/auth/native/signup/route.ts
import { NextResponse } from "next/server";
import { nativeAuthApi } from "@/lib/native-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, otp, continuationToken } = body;

    if (action === "send-otp") {
      // Step 1: Start sign-up
      const startData = await nativeAuthApi.signUpStart(email);

      if (startData.error) {
        throw new Error(startData.error_description || startData.error);
      }

      // Step 2: Request OTP challenge (this triggers the email)
      const challengeData = await nativeAuthApi.signUpChallenge(startData.continuation_token);

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
      // Step 3: Verify OTP to complete sign-up
      const data = await nativeAuthApi.signUpContinue(continuationToken, otp);

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      return NextResponse.json({
        success: true,
        message: "Account created successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Native signup error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
