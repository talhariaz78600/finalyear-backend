require('dotenv').config();
const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  GetObjectCommand,
  ListPartsCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
// const sharp = require("sharp");
const multer = require('multer');
// const heicConvert = require("heic-convert");

const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const bucketName = process.env.AWS_STORAGE_BUCKET_NAME;
// eslint-disable-next-line no-unused-vars
const AWSRegion = process.env.REGION;

const upload = multer();

const initiateMultipartUpload = async (fileName, fileType) => {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: fileName,
    ContentType: fileType,
    ACL: 'public-read'
  });
  const response = await s3Client.send(command);
  return { uploadId: response.UploadId };
};

const createPresignedUrl = async (fileName, uploadId, partNumber, filetype) => {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: fileName,
    UploadId: uploadId,
    PartNumber: partNumber,
    ContentType: filetype,
    ACL: 'public-read',
    Expires: 3600 // 1 hour
  });
  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
    return url;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
/**
 * Upload part to S3
 */
const uploadPart = async (index, fileName, fileBuffer, uploadId, fileType) => {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: fileName,
    UploadId: uploadId,
    PartNumber: Number(index) + 1,
    Body: fileBuffer,
    ContentType: fileType,
    ACL: 'public-read'
  });
  return s3Client.send(command);
};

const completeMultipartUpload = async (filename, uploadId) => {
  console.log('aya ma complete upload');

  const command = new ListPartsCommand({
    Bucket: bucketName,
    Key: filename,
    UploadId: uploadId,
    ACL: 'public-read'
  });

  try {
    const data = await s3Client.send(command);
    console.log(data);
    if (!data) {
      throw new Error('data not provided for completing multipart upload.');
    }
    const parts = data?.Parts?.map((part) => ({
      ETag: part.ETag,
      PartNumber: part.PartNumber
    }));

    if (!parts || parts.length === 0) {
      throw new Error('No parts provided for completing multipart upload.');
    }
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: filename,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });

    const response = await s3Client.send(completeCommand);

    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const generateDownloadUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ACL: 'public-read'
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

// const streamToBuffer = async (stream) => {
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     stream.on("data", (chunk) => chunks.push(chunk));
//     stream.on("end", () => resolve(Buffer.concat(chunks)));
//     stream.on("error", reject);
//   });
// };

// const generateBlurredThumbnail = async (
//   videoBuffer,
//   tempDir,
//   thumbnailWidth,
//   thumbnailHeight
// ) => {
//   const tempVideoPath = path.join(tempDir, `temp-video-${Date.now()}.mp4`);
//   const tempThumbnailPath = path.join(
//     tempDir,
//     `temp-thumbnail-${Date.now()}.jpg`
//   );

//   fs.writeFileSync(tempVideoPath, videoBuffer);

//   return new Promise((resolve, reject) => {
//     const timestamp = "00:00:01";

//     execFile(
//       "ffmpeg",
//       [
//         "-i",
//         tempVideoPath,
//         "-ss",
//         timestamp,
//         "-vframes",
//         "1",
//         tempThumbnailPath,
//       ],
//       async (error, stdout, stderr) => {
//         if (error) {
//           console.error("Error extracting frame with ffmpeg:", error);
//           reject(error);
//           return;
//         }
//         console.log("Thumbnail generated successfully:", tempThumbnailPath);

//         try {
//           const blurredBuffer = await sharp(tempThumbnailPath)
//             .resize({ width: thumbnailWidth, height: thumbnailHeight })
//             .blur(7)
//             .toBuffer();
//           console.log("Blurred buffer generated successfully.");

//           resolve(blurredBuffer);
//         } catch (sharpError) {
//           console.error("Error processing image with sharp:", sharpError);
//           reject(sharpError);
//         }
//       }
//     );
//   });
// };

// const cleanUpFiles = (tempDir) => {
//   try {
//     const files = fs.readdirSync(tempDir);

//     files.forEach((file) => {
//       const filePath = path.join(tempDir, file);

//       try {
//         // Adjust permissions before deletion if necessary
//         fs.chmodSync(filePath, 0o666);
//         fs.unlinkSync(filePath);
//         console.log("Deleted temp file:", filePath);
//       } catch (error) {
//         console.error(`Error deleting file ${filePath}:`, error);
//       }
//     });

//     console.log("All files in the temp folder have been cleaned up.");
//   } catch (error) {
//     console.error("Error during temp folder cleanup:", error);
//   }
// };

const deleteMedia = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  try {
    const response = await s3Client.send(command);
    console.log(`Media deleted successfully: ${key}`);
    return response;
  } catch (error) {
    console.log(`Error deleting media ${key}:`, error);
    throw error;
  }
};

module.exports = {
  initiateMultipartUpload,
  createPresignedUrl,
  uploadPart,
  completeMultipartUpload,
  generateDownloadUrl,
  upload,
  deleteMedia
};
