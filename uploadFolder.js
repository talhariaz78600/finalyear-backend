require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const {   initiateMultipartUpload,
    uploadPart,
    completeMultipartUpload } = require('./src/middlewares/aws-v3');

const folderPath = path.join(__dirname, 'gala-images');

const createTimestampedFileName = (originalName) => {
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  return `${baseName}-${timestamp}${ext}`;
};

const uploadedFilesInfo = [];

const uploadFile = async (filePath, originalFileName) => {
  const fileBuffer = fs.readFileSync(filePath);
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  const fileSize = fs.statSync(filePath).size;
  const timestampedName = createTimestampedFileName(originalFileName);
  const s3Key = `gala-images/${timestampedName}`;

  try {
    const { uploadId } = await initiateMultipartUpload(s3Key, contentType);

    await uploadPart(0, s3Key, fileBuffer, uploadId, contentType);

    const completeData = await completeMultipartUpload(s3Key, uploadId);

    uploadedFilesInfo.push({
      key: s3Key,
      location: completeData.Location,
      metadata: {
        originalName: originalFileName,
        mimeType: contentType,
        size: fileSize,
        uploadedAt: new Date().toISOString()
      }
    });

    console.log(`✅ Uploaded: ${originalFileName}`);
  } catch (error) {
    console.error(`❌ Failed to upload ${originalFileName}`, error);
  }
};

fs.readdir(folderPath, async (err, files) => {
  if (err) {
    return console.error('Error reading folder:', err);
  }

  for (const fileName of files) {
    const filePath = path.join(folderPath, fileName);
    console.log("filePath", filePath);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
        console.log("filePath start uploading", filePath);
      await uploadFile(filePath, fileName);
    }
  }

  // Final output
  console.log('\n📦 Uploaded Files Summary:');
  console.log(JSON.stringify(uploadedFilesInfo, null, 2));
});
