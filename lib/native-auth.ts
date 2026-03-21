// lib/native-auth.ts
// Direct implementation of Entra ID / CIAM Native Authentication REST APIs

const tenantId = process.env.AZURE_AD_TENANT_ID!;
const clientId = process.env.AZURE_AD_CLIENT_ID!;

// Note: If using Entra External ID (CIAM), authority usually looks like:
// const authority = `https://${tenantName}.ciamlogin.com/${tenantId}`;
// For standard Entra ID or B2C, we default to the login.microsoftonline.com authority:
const tenantName = "theforcelabs"; // e.g., if your default domain is contoso.onmicrosoft.com, this is 'contoso'
const authority = `https://${tenantName}.ciamlogin.com/${tenantId}`;

export const nativeAuthApi = {
  // ─── Sign-Up Flow ────────────────────────────────────────────────────

  /** Step 1: Start the sign-up process */
  async signUpStart(email: string) {
    const url = `${authority}/signup/v1.0/start`;
    const body = `client_id=${clientId}&challenge_type=oob%20password%20redirect&username=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await response.json();
  },

  /** Step 2: Request the OTP challenge (this actually sends the email) */
  async signUpChallenge(continuationToken: string) {
    const url = `${authority}/signup/v1.0/challenge`;
    const body = `client_id=${clientId}&challenge_type=oob%20redirect&continuation_token=${encodeURIComponent(continuationToken)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await response.json();
  },

  /** Step 3: Submit the OTP to complete sign-up */
  async signUpContinue(continuationToken: string, oobCode: string) {
    const url = `${authority}/signup/v1.0/continue`;
    const body = `client_id=${clientId}&grant_type=oob&continuation_token=${encodeURIComponent(continuationToken)}&oob=${encodeURIComponent(oobCode)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await response.json();
  },

  // ─── Sign-In Flow ────────────────────────────────────────────────────

  /** Step 1: Initiate the sign-in process */
  async signInStart(email: string) {
    const url = `${authority}/oauth2/v2.0/initiate`;
    const body = `client_id=${clientId}&challenge_type=oob%20password%20redirect&username=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await response.json();
  },

  /** Step 2: Request the OTP challenge (this actually sends the email) */
  async signInChallenge(continuationToken: string) {
    const url = `${authority}/oauth2/v2.0/challenge`;
    const body = `client_id=${clientId}&challenge_type=oob%20redirect&continuation_token=${encodeURIComponent(continuationToken)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await response.json();
  },

  /** Step 3: Submit the OTP to get tokens */
  async signInToken(continuationToken: string, oobCode: string) {
    const url = `${authority}/oauth2/v2.0/token`;
    const body = `client_id=${clientId}&grant_type=oob&continuation_token=${encodeURIComponent(continuationToken)}&oob=${encodeURIComponent(oobCode)}&scope=openid%20offline_access`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return await response.json();
  },
};
