
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../firebase";
import type { Timestamp } from "firebase-admin/firestore";

/**
 * [PUBLIC] Fetches all necessary data for the booking page.
 */
export const fetchBookingPageData = onRequest({ 
  region: 'europe-west1', 
  memory: '512MiB',
  cors: true 
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' });
        return;
    }
        
        const { propertySlug } = request.body.data;
        if (!propertySlug || typeof propertySlug !== "string") {
            response.status(400).send({ error: "Missing 'propertySlug'." });
            return;
        }

        try {
            const propertyQuery = db.collection("properties").where("slug", "==", propertySlug).limit(1);
            const propertyQuerySnapshot = await propertyQuery.get();
            if (propertyQuerySnapshot.empty) {
                response.status(404).send({ error: "Property not found." });
                return;
            }
            const propertyId = propertyQuerySnapshot.docs[0].id;

            const propertyPromise = db.doc(`properties/${propertyId}`).get();
            const ratePlansPromise = db
                .collection("ratePlans")
                .where("propertyId", "==", propertyId)
                .get();
            const promotionsPromise = db
                .collection("promotions")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();
            const packagesPromise = db
                .collection("packages")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();
            const servicesPromise = db
                .collection("services")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();
            const mealPlansPromise = db
                .collection("mealPlans")
                .where("propertyId", "==", propertyId)
                .where("active", "==", true)
                .get();

            const [
                propertySnap,
                ratePlansSnap,
                promotionsSnap,
                packagesSnap,
                servicesSnap,
                mealPlansSnap,
            ] = await Promise.all([
                propertyPromise,
                ratePlansPromise,
                promotionsPromise,
                packagesPromise,
                servicesPromise,
                mealPlansPromise,
            ]);

            const property = propertySnap.exists ?
                { id: propertySnap.id, ...propertySnap.data() } :
                null;
            const ratePlans = ratePlansSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            const promotions = promotionsSnap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id, ...data,
                    startDate: (data.startDate as Timestamp).toDate().toISOString(),
                    endDate: (data.endDate as Timestamp).toDate().toISOString(),
                };
            });
            const packages = packagesSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            const services = servicesSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            const mealPlans = mealPlansSnap.docs.map((d) => ({
                id: d.id, ...d.data(),
            }));
            
            response.send({
                data: {
                    success: true, 
                    property,
                    ratePlans,
                    promotions,
                    packages,
                    services,
                    mealPlans,
                }
            });

        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "An unknown error.";
            logger.error("Error fetching booking page data:", errorMessage);
            response.status(500).send({ success: false, error: "An unexpected error occurred." });
        }
});
