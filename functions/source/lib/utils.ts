import { db } from "../firebase";

/**
 * Helper function to generate a URL-friendly slug from a string.
 */
export const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

/**
 * Generates a unique slug for a property, ensuring no duplicates exist.
 * If the base slug exists, appends a number until unique.
 */
export const generateUniqueSlug = async (propertyName: string, excludePropertyId?: string): Promise<string> => {
  let slug = generateSlug(propertyName);
  let isSlugUnique = false;
  let attempt = 0;

  while (!isSlugUnique) {
    const slugToCheck = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    let slugQuery = db.collection("properties").where("slug", "==", slugToCheck).limit(1);

    // If updating an existing property, exclude it from the uniqueness check
    if (excludePropertyId) {
      slugQuery = slugQuery.where("__name__", "!=", excludePropertyId);
    }

    const snapshot = await slugQuery.get();
    if (snapshot.empty) {
      slug = slugToCheck;
      isSlugUnique = true;
    } else {
      attempt++;
    }
  }

  return slug;
};