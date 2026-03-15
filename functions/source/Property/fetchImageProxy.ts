import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import type { CallableRequest } from "firebase-functions/v2/https";

exports.fetchImageProxy = onCall({ 
  region: 'europe-west1', 
  memory: '512MiB',
  cors: true 
}, async (request: CallableRequest<any>) => {
  // Authentication check - onCall automatically provides request.auth
  if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Unauthorized - User must be authenticated.');
  }

  // Get the URL from the request data
  const url = request.data?.url;
  if (!url) {
    throw new HttpsError('invalid-argument', 'An image URL must be provided in the data payload.');
  }

  try {
    const bucket = getStorage().bucket();
    const decodedUrl = decodeURIComponent(url);
    const pathRegex = /o\/(.*?)\?alt=media/;
    const match = decodedUrl.match(pathRegex);

    if (!match || !match[1]) {
      throw new Error('Invalid Firebase Storage URL format. Could not extract file path.');
    }

    const filePath = match[1];
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new HttpsError('not-found', `File not found at path: ${filePath}`);
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/png';
    const [buffer] = await file.download();
    const base64 = buffer.toString('base64');
    const dataUri = `data:${contentType};base64,${base64}`;

    return { dataUri };

  } catch (error: any) {
    logger.error("Error converting image to data URI:", error);
    throw new HttpsError('internal', error.message || 'Failed to process image.');
  }
});
