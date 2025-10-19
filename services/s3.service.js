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

function formatBytes(bytes) {
    return Math.round(bytes / (960 * 960));
}




module.exports = { uploadImage };
