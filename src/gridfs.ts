import fs from "fs";
import path from "path";
import { db } from "./model";
import { GridFSBucket } from "mongodb";
const bucket = new GridFSBucket(db, { bucketName: 'images' });

export const uploadFile = async (file: Buffer, filename: string) => {
    const uploadStream = bucket.openUploadStream(filename);
    uploadStream.write(file);
    uploadStream.end();
    return uploadStream.id;
}

// export const downloadFile = async (id: string) => {
//     const downloadStream = bucket.openDownloadStream(id);
//     return downloadStream;
// }

export const existsFileInGridFS = async (filename: string) => {
    const files = await bucket.find({ filename }).toArray();
    return files.length > 0
}

export const uploadToGridFS = async (uri: string) => {
    await new Promise((resolve, reject) => {
        fs.createReadStream(uri).pipe(bucket.openUploadStream(path.basename(uri), {
            chunkSizeBytes: 1048576, 
            // metadata: { field: 'myField', value: 'myValue' }
        })).on('finish', resolve).on('error', reject)
    })
}




