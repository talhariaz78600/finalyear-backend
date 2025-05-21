const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function uploadChunks(filePath, presignedUrls, chunkSize) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const totalChunks = presignedUrls.length;

  const uploadPromises = presignedUrls.map((url, i) => {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileBuffer.length);
    const chunk = fileBuffer.slice(start, end);

    console.log(`Uploading chunk ${i + 1}/${totalChunks}...`);

    return axios
      .put(url, chunk, {
        headers: { 'Content-Type': 'image/jpg' }
      })
      .then(() => console.log(`Chunk ${i + 1} uploaded successfully!`))
      .catch((error) => console.error(`Error uploading chunk ${i + 1}:`, error.message));
  });

  await Promise.all(uploadPromises);
}

const filePath = path.join(__dirname, 'newfile.jpg');
const chunkSize = 5 * 1024 * 1024; // 5MB chunks

const presignedUrls = [
  'https://demo-automation-storages.s3.us-east-2.amazonaws.com/newfile.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAVY2PGVDIYHTIDSPV%2F20250324%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20250324T200753Z&X-Amz-Expires=3600&X-Amz-Signature=bd2f6b2440e2268569f2e5b692c6a534481630ee133faad0096735742dc525dd&X-Amz-SignedHeaders=host&partNumber=1&uploadId=9ERTHlKCj54rEefmQ_4_h1uAvxlz1mBMRiHT3m3Bv2JoDdtdLZyVGTs6jKBb8SGOYLq1wXuVDKHA68SdNw3Jwt7aV9MLzIEAgDgbN6EPR1_ymKv5I3CCfPbYdaMj6_pN&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=UploadPart',
  'https://demo-automation-storages.s3.us-east-2.amazonaws.com/newfile.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAVY2PGVDIYHTIDSPV%2F20250324%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20250324T200753Z&X-Amz-Expires=3600&X-Amz-Signature=bf23468334a3f42f6d9eec49940eac72b27e245aeabd14d13cb2cdff8ea57eeb&X-Amz-SignedHeaders=host&partNumber=2&uploadId=9ERTHlKCj54rEefmQ_4_h1uAvxlz1mBMRiHT3m3Bv2JoDdtdLZyVGTs6jKBb8SGOYLq1wXuVDKHA68SdNw3Jwt7aV9MLzIEAgDgbN6EPR1_ymKv5I3CCfPbYdaMj6_pN&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=UploadPart'
];

uploadChunks(filePath, presignedUrls, chunkSize);
