
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from './firebase';

export const uploadFile = async (pathPrefix: string, file: File): Promise<string> => {
    if (!file) throw new Error("No file provided for upload.");

    const fileRef = ref(storage, `${pathPrefix}/${Date.now()}_${file.name}`);
    
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    
    return downloadURL;
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
    if (!fileUrl || !fileUrl.startsWith('gs://') && !fileUrl.startsWith('https://firebasestorage.googleapis.com')) {
        console.warn(`Not a valid Firebase Storage URL, skipping deletion: ${fileUrl}`);
        return;
    }
    
    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            console.warn(`File not found for deletion, it might have been already deleted: ${fileUrl}`);
        } else {
            console.error("Error deleting file from Firebase Storage:", error);
            throw error; // Re-throw other errors
        }
    }
};
