import express from "express";
import { DashboardRouteDeps } from "./types";
import { getUserTrashCollectionId, isTrashCollectionId } from "./trash";

const VALID_VISIBILITIES = new Set(["private", "shared"]);
const VALID_SHARE_PERMISSIONS = new Set(["view", "edit"]);

export const registerCollectionRoutes = (
  app: express.Express,
  deps: DashboardRouteDeps
) => {
  const {
    prisma,
    requireAuth,
    asyncHandler,
    collectionNameSchema,
    sanitizeText,
    ensureTrashCollection,
    invalidateDrawingsCache,
    config,
    logAuditEvent,
  } = deps;

  app.get("/collections", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const trashCollectionId = getUserTrashCollectionId(req.user.id);
    await ensureTrashCollection(prisma, req.user.id);

    const rawCollections = await prisma.collection.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { visibility: "shared" },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    const hasInternalTrash = rawCollections.some((collection) => collection.id === trashCollectionId);
    const collections = rawCollections
      .filter((collection) => !(hasInternalTrash && collection.id === "trash"))
      .map((collection) => {
        const isTrash = collection.id === trashCollectionId;
        const isOwner = collection.userId === req.user!.id;
        return {
          id: isTrash ? "trash" : collection.id,
          name: isTrash ? "Trash" : collection.name,
          userId: collection.userId,
          visibility: collection.visibility,
          sharePermission: collection.sharePermission,
          isOwner,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
        };
      });
    return res.json(collections);
  }));

  app.post("/collections", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = collectionNameSchema.safeParse(req.body.name);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        message: "Collection name must be between 1 and 100 characters",
      });
    }

    const sanitizedName = sanitizeText(parsed.data, 100);
    const newCollection = await prisma.collection.create({
      data: { name: sanitizedName, userId: req.user.id },
    });
    return res.json({
      ...newCollection,
      isOwner: true,
    });
  }));

  app.put("/collections/:id", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (isTrashCollectionId(id, req.user.id)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Trash collection cannot be renamed",
      });
    }
    const existingCollection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existingCollection) return res.status(404).json({ error: "Collection not found" });

    const parsed = collectionNameSchema.safeParse(req.body.name);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        message: "Collection name must be between 1 and 100 characters",
      });
    }

    const sanitizedName = sanitizeText(parsed.data, 100);
    const updateResult = await prisma.collection.updateMany({
      where: { id, userId: req.user.id },
      data: { name: sanitizedName },
    });
    if (updateResult.count === 0) {
      return res.status(404).json({ error: "Collection not found" });
    }
    const updatedCollection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!updatedCollection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    return res.json({
      ...updatedCollection,
      isOwner: true,
    });
  }));

  app.put("/collections/:id/share", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (isTrashCollectionId(id, req.user.id)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Trash collection cannot be shared",
      });
    }

    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const { visibility, sharePermission } = req.body ?? {};

    if (!VALID_VISIBILITIES.has(visibility)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Visibility must be 'private' or 'shared'",
      });
    }

    if (sharePermission !== undefined && !VALID_SHARE_PERMISSIONS.has(sharePermission)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Share permission must be 'view' or 'edit'",
      });
    }

    const data: { visibility: string; sharePermission?: string } = { visibility };
    if (sharePermission !== undefined) {
      data.sharePermission = sharePermission;
    } else if (visibility === "shared" && collection.sharePermission === "view") {
      // Keep existing sharePermission when switching to shared without specifying.
    }

    const updated = await prisma.collection.update({
      where: { id },
      data,
    });
    invalidateDrawingsCache();

    if (config.enableAuditLogging) {
      await logAuditEvent({
        userId: req.user.id,
        action: "collection_share_updated",
        resource: `collection:${id}`,
        ipAddress: req.ip || req.connection.remoteAddress || undefined,
        userAgent: req.headers["user-agent"] || undefined,
        details: { collectionId: id, collectionName: collection.name, visibility, sharePermission },
      });
    }

    return res.json({
      ...updated,
      isOwner: true,
    });
  }));

  app.delete("/collections/:id", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    if (isTrashCollectionId(id, req.user.id)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Trash collection cannot be deleted",
      });
    }
    const collection = await prisma.collection.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!collection) return res.status(404).json({ error: "Collection not found" });

    await prisma.$transaction([
      // Move ALL drawings out of the collection (including those from other users
      // in shared collections) to avoid orphan references.
      prisma.drawing.updateMany({
        where: { collectionId: id },
        data: { collectionId: null },
      }),
      prisma.collection.deleteMany({ where: { id, userId: req.user.id } }),
    ]);
    invalidateDrawingsCache();

    if (config.enableAuditLogging) {
      await logAuditEvent({
        userId: req.user.id,
        action: "collection_deleted",
        resource: `collection:${id}`,
        ipAddress: req.ip || req.connection.remoteAddress || undefined,
        userAgent: req.headers["user-agent"] || undefined,
        details: { collectionId: id, collectionName: collection.name },
      });
    }

    return res.json({ success: true });
  }));
};
