import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAdminRoutes } from "./adminRoutes";

const buildApp = (options?: {
  authMode?: "local" | "hybrid" | "oidc_enforced";
  oidcEnabled?: boolean;
}) => {
  const router = express.Router();
  router.use(express.json());

  const prisma = {
    systemConfig: {
      upsert: vi.fn(),
    },
    signupLink: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  } as any;

  registerAdminRoutes({
    router,
    prisma,
    requireAuth: ((req: any, _res: any, next: any) => {
      req.user = {
        id: "admin-id",
        email: "admin@test.local",
        name: "Admin",
        role: "ADMIN",
      };
      next();
    }) as any,
    accountActionRateLimiter: ((_req: any, _res: any, next: any) => next()) as any,
    ensureAuthEnabled: vi.fn().mockResolvedValue(true),
    ensureSystemConfig: vi.fn().mockResolvedValue({
      id: "default",
      registrationEnabled: false,
      registrationMode: "disabled",
      oidcJitProvisioningEnabled: null,
      authLoginRateLimitEnabled: true,
      authLoginRateLimitWindowMs: 900000,
      authLoginRateLimitMax: 20,
    }),
    parseLoginRateLimitConfig: vi.fn().mockReturnValue({ enabled: true, windowMs: 900000, max: 20 }),
    applyLoginRateLimitConfig: vi.fn().mockReturnValue({ enabled: true, windowMs: 900000, max: 20 }),
    resetLoginAttemptKey: vi.fn(),
    requireAdmin: ((req: any, _res: any) => Boolean(req.user && req.user.role === "ADMIN")) as any,
    findUserByIdentifier: vi.fn(),
    countActiveAdmins: vi.fn().mockResolvedValue(1),
    sanitizeText: (input: unknown) => String(input ?? "").trim(),
    generateTempPassword: vi.fn().mockReturnValue("TempPass123!"),
    generateTokens: vi.fn().mockReturnValue({ accessToken: "a", refreshToken: "r" }),
    getRefreshTokenExpiresAt: vi.fn().mockReturnValue(new Date()),
    config: {
      authMode: options?.authMode ?? "oidc_enforced",
      frontendUrl: "https://app.example.com",
      enableAuditLogging: false,
      enableRefreshTokenRotation: false,
      oidc: {
        enabled: options?.oidcEnabled ?? true,
        providerName: "Auth0",
        jitProvisioning: true,
      },
    },
    defaultSystemConfigId: "default",
    setAuthCookies: vi.fn(),
    requireCsrf: vi.fn().mockReturnValue(true),
  });

  const app = express();
  app.use(router);
  return { app, prisma };
};

describe("admin OIDC access controls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects local registration mode updates in oidc_enforced mode", async () => {
    const { app } = buildApp({ authMode: "oidc_enforced", oidcEnabled: true });

    const response = await request(app).post("/registration/mode").send({ mode: "public" });

    expect(response.status).toBe(409);
    expect(response.body?.message).toContain("Local self-sign-up");
  });

  it("updates the persisted local registration mode", async () => {
    const { app, prisma } = buildApp({ authMode: "local", oidcEnabled: false });
    prisma.systemConfig.upsert.mockResolvedValue({
      id: "default",
      registrationEnabled: false,
      registrationMode: "link_only",
    });

    const response = await request(app)
      .post("/registration/mode")
      .send({ mode: "link_only" });

    expect(response.status).toBe(200);
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { registrationMode: "link_only", registrationEnabled: false },
      })
    );
    expect(response.body?.registrationMode).toBe("link_only");
    expect(response.body?.registrationEnabled).toBe(false);
  });

  it("updates the persisted OIDC JIT provisioning override", async () => {
    const { app, prisma } = buildApp({ authMode: "oidc_enforced", oidcEnabled: true });
    prisma.systemConfig.upsert.mockResolvedValue({
      id: "default",
      oidcJitProvisioningEnabled: false,
    });

    const response = await request(app)
      .post("/oidc/jit-provisioning")
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { oidcJitProvisioningEnabled: false },
      })
    );
    expect(response.body?.oidcJitProvisioningEnabled).toBe(false);
  });

  it("creates a reusable signup link and returns a full signup URL", async () => {
    const { app, prisma } = buildApp({ authMode: "local", oidcEnabled: false });
    prisma.signupLink.create.mockResolvedValue({
      id: "signup-link-1",
      createdByUserId: "admin-id",
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app).post("/signup-links").send({ expiresAt: null });

    expect(response.status).toBe(201);
    expect(prisma.signupLink.create).toHaveBeenCalled();
    expect(response.body?.signupUrl).toContain("https://app.example.com/register?signupToken=");
  });

  it("revokes a signup link", async () => {
    const { app, prisma } = buildApp({ authMode: "local", oidcEnabled: false });
    prisma.signupLink.findUnique.mockResolvedValue({
      id: "signup-link-1",
      revokedAt: null,
    });
    prisma.signupLink.update.mockResolvedValue({
      id: "signup-link-1",
      createdByUserId: "admin-id",
      expiresAt: null,
      revokedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app).post("/signup-links/signup-link-1/revoke").send({});

    expect(response.status).toBe(200);
    expect(prisma.signupLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "signup-link-1" },
      })
    );
    expect(response.body?.signupLink?.revokedAt).toBeTruthy();
  });

  it("creates an invited OIDC-only user without a local password", async () => {
    const { app, prisma } = buildApp({ authMode: "oidc_enforced", oidcEnabled: true });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: any) => ({
      id: "user-1",
      username: data.username,
      email: data.email,
      name: data.name,
      role: data.role,
      mustResetPassword: data.mustResetPassword,
      isActive: data.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const response = await request(app).post("/users").send({
      email: "invitee@example.com",
      name: "Invitee",
      oidcOnly: true,
      role: "USER",
      isActive: true,
    });

    expect(response.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "invitee@example.com",
          passwordHash: "",
          mustResetPassword: false,
        }),
      })
    );
  });

  it("rejects OIDC-only invited users when OIDC is disabled", async () => {
    const { app } = buildApp({ authMode: "local", oidcEnabled: false });

    const response = await request(app).post("/users").send({
      email: "invitee@example.com",
      name: "Invitee",
      oidcOnly: true,
    });

    expect(response.status).toBe(409);
    expect(response.body?.message).toContain("OIDC-only invited users require OIDC");
  });
});
