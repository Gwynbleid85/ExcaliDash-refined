import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerCoreRoutes } from "./coreRoutes";

const buildApp = () => {
  const router = express.Router();
  router.use(express.json());

  const prisma = {
    user: {
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "invitee@example.com",
        name: "Invitee",
        role: "USER",
        mustResetPassword: false,
        createdAt: new Date().toISOString(),
      }),
    },
    signupLink: {
      findFirst: vi.fn(),
    },
    collection: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    drawing: {
      count: vi.fn().mockResolvedValue(0),
    },
    refreshToken: {
      create: vi.fn(),
    },
  } as any;

  registerCoreRoutes({
    router,
    prisma,
    requireAuth: ((_req: any, _res: any, next: any) => next()) as any,
    optionalAuth: ((_req: any, _res: any, next: any) => next()) as any,
    loginAttemptRateLimiter: ((_req: any, _res: any, next: any) => next()) as any,
    ensureAuthEnabled: vi.fn().mockResolvedValue(true),
    ensureSystemConfig: vi.fn().mockResolvedValue({
      id: "default",
      authEnabled: true,
      authOnboardingCompleted: true,
      registrationEnabled: false,
      registrationMode: "link_only",
      oidcJitProvisioningEnabled: null,
    }),
    findUserByIdentifier: vi.fn(),
    sanitizeText: (input: unknown) => String(input ?? "").trim(),
    requireCsrf: vi.fn().mockReturnValue(true),
    isJwtPayload: ((decoded: any) => Boolean(decoded && decoded.userId)) as any,
    config: {
      authMode: "local",
      jwtSecret: "test-secret",
      jwtAccessExpiresIn: "15m",
      enableRefreshTokenRotation: false,
      enableAuditLogging: false,
      oidc: {
        enabled: false,
        enforced: false,
        providerName: "OIDC",
        jitProvisioning: false,
      },
      bootstrapSetupCodeTtlMs: 900000,
      bootstrapSetupCodeMaxAttempts: 5,
    },
    generateTokens: vi.fn().mockReturnValue({ accessToken: "access", refreshToken: "refresh" }),
    getRefreshTokenExpiresAt: vi.fn().mockReturnValue(new Date()),
    isMissingRefreshTokenTableError: vi.fn().mockReturnValue(false),
    bootstrapUserId: "bootstrap-user",
    defaultSystemConfigId: "default",
    clearAuthEnabledCache: vi.fn(),
    setAuthCookies: vi.fn(),
    setAccessTokenCookie: vi.fn(),
    clearAuthCookies: vi.fn(),
    readRefreshTokenFromRequest: vi.fn().mockReturnValue(null),
  });

  const app = express();
  app.use(router);
  return { app, prisma };
};

describe("/auth/register link-only mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects registration without a signup token", async () => {
    const { app } = buildApp();

    const response = await request(app).post("/register").send({
      email: "invitee@example.com",
      password: "Password123!",
      name: "Invitee",
    });

    expect(response.status).toBe(403);
    expect(response.body?.message).toContain("signup link");
  });

  it("registers a local user when a valid signup token is provided", async () => {
    const { app, prisma } = buildApp();
    prisma.signupLink.findFirst.mockResolvedValue({
      id: "signup-link-1",
      expiresAt: null,
      revokedAt: null,
    });

    const response = await request(app).post("/register").send({
      email: "invitee@example.com",
      password: "Password123!pass",
      name: "Invitee",
      signupToken: "esu_token",
    });

    expect(response.status).toBe(201);
    expect(prisma.signupLink.findFirst).toHaveBeenCalled();
    expect(response.body?.registrationMode).toBe("link_only");
    expect(response.body?.user?.email).toBe("invitee@example.com");
  });
});
