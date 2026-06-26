
import { createClient } from '@/utils/supabase/client';

const COMMUNICATION_BUCKET = 'communication-attachments';

const normalizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const buildAttachmentPath = (pathPrefix: string, file: File) => {
    const cleanPrefix = String(pathPrefix || '').replace(/^\/+|\/+$/g, '');
    return `${cleanPrefix}/${Date.now()}_${normalizeFileName(file.name)}`;
};

export const uploadFile = async (pathPrefix: string, file: File): Promise<string> => {
    if (!file) throw new Error('No file provided for upload.');

    const supabase = createClient();
    const filePath = buildAttachmentPath(pathPrefix, file);
    const { error } = await supabase.storage
        .from(COMMUNICATION_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage.from(COMMUNICATION_BUCKET).getPublicUrl(filePath);
    if (!data?.publicUrl) {
        throw new Error('Failed to resolve public URL for uploaded file.');
    }

    return data.publicUrl;
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
    if (!fileUrl) return;

    const supabase = createClient();
    const bucketPrefix = `/storage/v1/object/public/${COMMUNICATION_BUCKET}/`;
    const url = String(fileUrl);
    const bucketIndex = url.indexOf(bucketPrefix);

    if (bucketIndex === -1) {
        console.warn(`Not a Supabase public storage URL, skipping deletion: ${fileUrl}`);
        return;
    }

    const objectPath = decodeURIComponent(url.slice(bucketIndex + bucketPrefix.length));
    const { error } = await supabase.storage.from(COMMUNICATION_BUCKET).remove([objectPath]);

    if (error) {
        console.error('Error deleting file from Supabase Storage:', error);
        throw error;
    }
};
