import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { StringValue } from "ms";
import { PrismaClient } from "../generated/client";
import { config } from "../config";
import { getTestPrisma, setupTestDb } from "./testUtils";

describe("Drawings - Shared With Me", () => {
  const userAgent = "vitest-drawings-shared";
  let prisma: PrismaClient;
  let app: any;

  beforeAll(async () => {
    setupTestDb();
    prisma = getTestPrisma();
    ({ app } = await import("../index"));

    await prisma.systemConfig.upsert({
      where: { id: "default" },
      update: {
        authEnabled: true,
        registrationEnabled: false,
      },
      create: {
        id: "default",
        authEnabled: true,
        registrationEnabled: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createAccessToken = (user: { id: string; email: string }) => {
    const signOptions: SignOptions = { expiresIn: config.jwtAccessExpiresIn as StringValue };
    return jwt.sign(
      { userId: user.id, email: user.email, type: "access" },
      config.jwtSecret,
      signOptions
    );
  };

  it("does not include drawings you own even if you have a self permission row", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    const userA = await prisma.user.create({
      data: {
        email: "user-a@test.local",
        passwordHash,
        name: "User A",
        role: "USER",
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const userB = await prisma.user.create({
      data: {
        email: "user-b@test.local",
        passwordHash,
        name: "User B",
        role: "USER",
        isActive: true,
      },
      select: { id: true },
    });

    const drawingOwnedByA = await prisma.drawing.create({
      data: {
        name: "Owned by A",
        elements: "[]",
        appState: "{}",
        files: "{}",
        userId: userA.id,
        collectionId: null,
        version: 1,
      },
      select: { id: true },
    });

    const drawingOwnedByB = await prisma.drawing.create({
      data: {
        name: "Owned by B",
        elements: "[]",
        appState: "{}",
        files: "{}",
        userId: userB.id,
        collectionId: null,
        version: 1,
      },
      select: { id: true },
    });

    // Simulate a deployment that stores an owner "self" permission row.
    await prisma.drawingPermission.create({
      data: {
        drawingId: drawingOwnedByA.id,
        granteeUserId: userA.id,
        permission: "edit",
        createdByUserId: userA.id,
      },
    });

    // A real share: drawing owned by B is shared to A.
    await prisma.drawingPermission.create({
      data: {
        drawingId: drawingOwnedByB.id,
        granteeUserId: userA.id,
        permission: "view",
        createdByUserId: userB.id,
      },
    });

    const tokenA = createAccessToken(userA);

    const response = await request(app)
      .get("/drawings/shared")
      .set("User-Agent", userAgent)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body?.drawings)).toBe(true);
    const ids = (response.body.drawings as any[]).map((d) => d.id);
    expect(ids).toContain(drawingOwnedByB.id);
    expect(ids).not.toContain(drawingOwnedByA.id);
  });

  it("returns owner accessLevel for owned drawings in the default /drawings list", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    const owner = await prisma.user.create({
      data: {
        email: "owner-list@test.local",
        passwordHash,
        name: "Owner List",
        role: "USER",
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const drawing = await prisma.drawing.create({
      data: {
        name: "Owner Drawing",
        elements: "[]",
        appState: "{}",
        files: "{}",
        userId: owner.id,
        collectionId: null,
        version: 1,
      },
      select: { id: true },
    });

    const response = await request(app)
      .get("/drawings")
      .set("User-Agent", userAgent)
      .set("Authorization", `Bearer ${createAccessToken(owner)}`);

    expect(response.status).toBe(200);
    const listed = (response.body.drawings as any[]).find((item) => item.id === drawing.id);
    expect(listed?.accessLevel).toBe("owner");
  });

  it("computes /drawings accessLevel per row for shared collections", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    const owner = await prisma.user.create({
      data: {
        email: "shared-owner@test.local",
        passwordHash,
        name: "Shared Owner",
        role: "USER",
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const viewer = await prisma.user.create({
      data: {
        email: "shared-viewer@test.local",
        passwordHash,
        name: "Shared Viewer",
        role: "USER",
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const collection = await prisma.collection.create({
      data: {
        name: "Team Space",
        userId: owner.id,
        visibility: "shared",
        sharePermission: "view",
      },
      select: { id: true },
    });

    const collectionViewDrawing = await prisma.drawing.create({
      data: {
        name: "Collection View",
        elements: "[]",
        appState: "{}",
        files: "{}",
        userId: owner.id,
        collectionId: collection.id,
        version: 1,
      },
      select: { id: true },
    });

    const explicitEditDrawing = await prisma.drawing.create({
      data: {
        name: "Explicit Edit",
        elements: "[]",
        appState: "{}",
        files: "{}",
        userId: owner.id,
        collectionId: collection.id,
        version: 1,
      },
      select: { id: true },
    });

    await prisma.drawingPermission.create({
      data: {
        drawingId: explicitEditDrawing.id,
        granteeUserId: viewer.id,
        permission: "edit",
        createdByUserId: owner.id,
      },
    });

    const response = await request(app)
      .get("/drawings")
      .query({ collectionId: collection.id })
      .set("User-Agent", userAgent)
      .set("Authorization", `Bearer ${createAccessToken(viewer)}`);

    expect(response.status).toBe(200);

    const listedById = new Map((response.body.drawings as any[]).map((item) => [item.id, item]));
    expect(listedById.get(collectionViewDrawing.id)?.accessLevel).toBe("view");
    expect(listedById.get(explicitEditDrawing.id)?.accessLevel).toBe("edit");
  });
});
