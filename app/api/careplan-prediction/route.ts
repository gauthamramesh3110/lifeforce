import { NextRequest, NextResponse } from "next/server";

const FUNCTION_BASE_URL = process.env.CAREPLAN_FUNCTION_URL || "http://localhost:7071";
const FUNCTION_KEY = process.env.CAREPLAN_FUNCTION_KEY || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json(
      { error: "patientId is required" },
      { status: 400 }
    );
  }

  const url = new URL(`/api/predict/${encodeURIComponent(patientId)}`, FUNCTION_BASE_URL);
  if (FUNCTION_KEY) {
    url.searchParams.set("code", FUNCTION_KEY);
  }

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || "Prediction failed" },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Careplan prediction proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach prediction service" },
      { status: 502 }
    );
  }
}
