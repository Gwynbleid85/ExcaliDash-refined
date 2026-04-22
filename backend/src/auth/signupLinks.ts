import crypto from "crypto";
import { getTokenLookupCandidates, hashTokenForStorage } from "./tokenSecurity";

const SIGNUP_LINK_TOKEN_PREFIX = "esu_";

export const generateSignupLinkToken = (): string =>
  `${SIGNUP_LINK_TOKEN_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;

export const hashSignupLinkToken = (token: string): string => hashTokenForStorage(token);

export const getSignupLinkLookupCandidates = (token: string): string[] =>
  getTokenLookupCandidates(token);

export const buildSignupLinkUrl = (token: string, frontendUrl?: string): string => {
  const baseOrigin = frontendUrl
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];

  try {
    if (baseOrigin) {
      const url = new URL("/register", /^https?:\/\//i.test(baseOrigin) ? baseOrigin : `http://${baseOrigin}`);
      url.searchParams.set("signupToken", token);
      return url.toString();
    }
  } catch {
    // Fall back to a relative URL if FRONTEND_URL is missing or malformed.
  }

  return `/register?signupToken=${encodeURIComponent(token)}`;
};
