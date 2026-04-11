import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../config/s3.js";
import crypto from "crypto";

export const uploadToS3 = async (file, folder = "uploads") => {
  const ext = file.originalname.split(".").pop();
  const bucket = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error("S3 bucket is missing. Set AWS_BUCKET_NAME or S3_BUCKET_NAME in environment variables.");
  }

  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    })
  );

  return key;
};
