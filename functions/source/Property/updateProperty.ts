import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import { generateUniqueSlug } from "../lib/utils";

/**
 * Updates property settings, including regenerating slug if name changes.
 */
export const updateProperty = onCall({ memory: '512MiB' }, async (request) => {
  const { propertyId, updates } = request.data;

  if (!propertyId) {
    throw new HttpsError("invalid-argument", "Property ID is required.");
  }

  if (!updates || typeof updates !== "object") {
    throw new HttpsError("invalid-argument", "Updates object is required.");
  }

  try {
    const propertyRef = db.collection("properties").doc(propertyId);
    const propertyDoc = await propertyRef.get();

    if (!propertyDoc.exists) {
      throw new HttpsError("not-found", "Property not found.");
    }

    const currentProperty = propertyDoc.data();
    const updatesToApply: any = { ...updates };

    // If property name is being updated, regenerate the slug
    if (updates.name && updates.name !== currentProperty?.name) {
      const newSlug = await generateUniqueSlug(updates.name, propertyId);
      updatesToApply.slug = newSlug;
      logger.info(`Property ${propertyId} slug updated from '${currentProperty?.slug}' to '${newSlug}'`);
    }

    // Add timestamp
    updatesToApply.updatedAt = new Date();

    await propertyRef.update(updatesToApply);

    return {
      success: true,
      propertyId,
      updates: updatesToApply
    };

  } catch (error) {
    logger.error("Error updating property:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to update property.");
  }
});