const AWS = require('aws-sdk');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

async function uploadImage(base64) {

    const body = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `generated-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
        Body: body,
        ContentType: 'image/png'
    };
    const { Location } = await s3.upload(params).promise();
    if (Location) {
        console.log('Image saved on S3 ✅');
    }
    const retunObj = {
        Location: Location,
        size: formatBytes(body.length)
    }
    return retunObj;
}

async function uploadBuffer(buffer, key, contentType) {
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType
    };
    const { Location } = await s3.upload(params).promise();
    if (Location) {
        console.log(`Buffer saved on S3 to ${Location} ✅`);
    }
    return Location;
}

function formatBytes(bytes) {
    return Math.round(bytes / (960 * 960));
}

async function clearBucket() {
    const Bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!Bucket) {
        throw new Error('AWS_S3_BUCKET_NAME is not configured in environment variables');
    }

    let deletedCount = 0;

    try {
        while (true) {
            const data = await s3.listObjectVersions({ Bucket }).promise();
            const objectsToDelete = [];

            if (data.Versions && data.Versions.length > 0) {
                data.Versions.forEach(v => {
                    objectsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
                });
            }
            if (data.DeleteMarkers && data.DeleteMarkers.length > 0) {
                data.DeleteMarkers.forEach(dm => {
                    objectsToDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
                });
            }

            if (objectsToDelete.length === 0) break;

            await s3.deleteObjects({
                Bucket,
                Delete: { Objects: objectsToDelete, Quiet: true }
            }).promise();

            deletedCount += objectsToDelete.length;
            if (!data.IsTruncated) break;
        }
    } catch (err) {
        console.warn('listObjectVersions failed or not allowed, falling back to listObjectsV2:', err.message);
        while (true) {
            const data = await s3.listObjectsV2({ Bucket }).promise();
            if (!data.Contents || data.Contents.length === 0) break;

            const objectsToDelete = data.Contents.map(obj => ({ Key: obj.Key }));
            await s3.deleteObjects({
                Bucket,
                Delete: { Objects: objectsToDelete, Quiet: true }
            }).promise();

            deletedCount += objectsToDelete.length;
            if (!data.IsTruncated) break;
        }
    }

    return { success: true, deletedCount };
}

module.exports = { uploadImage, uploadBuffer, clearBucket };
