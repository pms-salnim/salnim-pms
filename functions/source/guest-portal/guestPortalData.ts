import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";

// Function URL constant
// @ts-ignore
const FUNCTION_URL = 'https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalData';

// CORS configuration
const allowedOrigins = ['https://app.salnimpms.com', 'http://localhost:3000'];

const corsHeaders = {
    'Access-Control-Allow-Origin': '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const guestPortalData = onRequest({
    region: 'europe-west1',
    memory: '512MiB',
    cors: allowedOrigins
}, async (request, response) => {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        corsHeaders['Access-Control-Allow-Origin'] = allowedOrigins.includes(request.headers.origin as string)
            ? (request.headers.origin as string)
            : 'https://app.salnimpms.com';
        Object.entries(corsHeaders).forEach(([key, val]) => response.set(key, val));
        response.status(204).send('');
        return;
    }

    // Handle POST requests
    if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' });
        return;
    }

    // Set CORS headers for actual requests
    corsHeaders['Access-Control-Allow-Origin'] = allowedOrigins.includes(request.headers.origin as string)
        ? (request.headers.origin as string)
        : 'https://app.salnimpms.com';
    Object.entries(corsHeaders).forEach(([key, val]) => response.set(key, val));

    const bodyData = request.body.data || request.body;
    const cleanPropertySlug = bodyData.propertySlug?.toString().trim().toLowerCase();

    if (!cleanPropertySlug) {
        logger.warn(`Missing propertySlug in request`);
        response.status(400).send({ error: "Missing 'propertySlug'." });
        return;
    }

    try {
        logger.info(`Fetching guest portal data for property: ${cleanPropertySlug}`);

        // Fetch property data
        const propertyQuery = await db.collection("properties")
            .where("slug", "==", cleanPropertySlug)
            .limit(1)
            .get();

        if (propertyQuery.empty) {
            logger.warn(`Property not found: ${cleanPropertySlug}`);
            response.status(404).send({ error: "Property not found" });
            return;
        }

        const propertyDoc = propertyQuery.docs[0];
        const propertyId = propertyDoc.id;
        const propertyData = propertyDoc.data();

        logger.info(`Property found: ${propertyId}`);

        // Extract relevant property data
        const propertyInfo = {
            id: propertyId,
            name: propertyData.name || '',
            email: propertyData.email || '',
            phone: propertyData.phone || '',
            address: propertyData.address || '',
            city: propertyData.city || '',
            country: propertyData.country || '',
            logo: propertyData.logo || null,
            description: propertyData.description || '',
            currency: propertyData.currency || 'USD',
            website: propertyData.website || '',
            instagram: propertyData.instagram || '',
            facebook: propertyData.facebook || '',
            twitter: propertyData.twitter || '',
        };

        // Fetch all active services for guest portal
        const servicesSnapshot = await db.collection("services")
            .where("propertyId", "==", propertyId)
            .where("status", "==", "Active")
            .where("guestPortal", "==", true)
            .get();

        const services = servicesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
        }));

        logger.info(`Found ${services.length} active services for property ${propertyId}`);

        // Fetch all active meal plans visible in guest portal
        const mealPlansSnapshot = await db.collection("mealPlans")
            .where("propertyId", "==", propertyId)
            .where("status", "==", "Active")
            .where("visibleInGuestPortal", "==", true)
            .get();

        const mealPlans = mealPlansSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                shortDescription: data.shortDescription || '',
                fullDescription: data.fullDescription || '',
                images: data.images || [],
                includedMeals: data.includedMeals || [],
                pricingModel: data.pricingModel || 'flat',
                basePrice: data.basePrice || 0,
                adultPrice: data.adultPrice || 0,
                childPrice: data.childPrice || 0,
                infantPrice: data.infantPrice || 0,
                enableAgePricing: data.enableAgePricing || false,
                categoryId: data.categoryId || '',
                mealPlanType: data.mealPlanType || '',
                minimumStay: data.minimumStay || 1,
                upgradeOptions: data.upgradeOptions || [],
                cancellationPolicy: data.cancellationPolicy || '',
                status: data.status || 'Active',
                visibleOnBooking: data.visibleOnBooking || false,
                visibleInGuestPortal: data.visibleInGuestPortal || false,
                propertyId: data.propertyId || '',
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            };
        });

        logger.info(`Found ${mealPlans.length} active meal plans visible in guest portal for property ${propertyId}`);

        // Fetch all active extras/packages
        const packagesSnapshot = await db.collection("packages")
            .where("propertyId", "==", propertyId)
            .where("active", "==", true)
            .get();

        const packages = packagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
        }));

        logger.info(`Found ${packages.length} active packages/extras for property ${propertyId}`);

        // Fetch all active menus with their sections and items
        const menusSnapshot = await db.collection("menus")
            .where("propertyId", "==", propertyId)
            .where("status", "==", "active")
            .get();

        const menus = menusSnapshot.docs
            .map(doc => {
                const data = doc.data();
                
                // Check if visible in guest portal (support both field structures)
                const isVisibleInGuestPortal = data.visibleInGuestPortal === true || data.visibility?.guestPortal === true;
                if (!isVisibleInGuestPortal) {
                    logger.info(`Menu ${doc.id} (${data.name}) excluded - visibleInGuestPortal: ${data.visibleInGuestPortal}, visibility.guestPortal: ${data.visibility?.guestPortal}`);
                    return null;
                }
                
                logger.info(`Menu ${doc.id} (${data.name}) included - linkedMealPlans: ${JSON.stringify(data.linkedMealPlans)}`);
                
                return {
                    id: doc.id,
                    name: data.name || '',
                    description: data.description || '',
                    mealType: data.mealType || '',
                    linkedMealPlans: Array.isArray(data.linkedMealPlans) ? data.linkedMealPlans : [],
                    defaultForMealPlans: Array.isArray(data.defaultForMealPlans) ? data.defaultForMealPlans : [],
                    sections: (Array.isArray(data.sections) ? data.sections : []).map((section: any) => ({
                        id: section.id || '',
                        name: section.name || '',
                        description: section.description || '',
                        displayOrder: section.displayOrder || 0,
                        items: (Array.isArray(section.items) ? section.items : []).map((item: any) => ({
                            id: item.id || '',
                            name: item.name || '',
                            description: item.description || '',
                            price: item.price || null,
                            currency: item.currency || data.currency || propertyData.currency || 'USD',
                            dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags : [],
                            displayOrder: item.displayOrder || 0,
                            available: item.available !== false,
                        })),
                    })),
                    status: data.status || 'active',
                    visibility: data.visibility || {},
                    visibleInGuestPortal: data.visibleInGuestPortal || false,
                    propertyId: data.propertyId || '',
                    createdAt: data.createdAt?.toDate?.() || data.createdAt,
                    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
                };
            })
            .filter((menu): menu is NonNullable<typeof menu> => menu !== null);

        logger.info(`Found ${menus.length} active menus visible in guest portal for property ${propertyId}`);

        logger.info(`Successfully retrieved all guest portal data for property: ${propertyId}`);

        response.status(200).json({
            success: true,
            data: {
                property: propertyInfo,
                services,
                mealPlans,
                packages,
                menus,
            }
        });

    } catch (error: any) {
        logger.error(`Error fetching guest portal data:`, error);
        response.status(500).json({
            error: "Failed to fetch guest portal data",
            message: error.message || 'Unknown error occurred'
        });
    }
});
