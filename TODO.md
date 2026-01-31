# S3 Integration for Image Upload

## Tasks
- [x] Install dependencies: multer-s3 and aws-sdk
- [x] Update utils/multerConfig.js to use S3 storage instead of disk storage
- [x] Update controller/consultationController.js to save S3 URL instead of local path
- [x] Add environment variables for AWS credentials (AWS_REGION, S3_BUCKET_NAME) - IAM role use karega
- [ ] Test image upload to S3 (local me nahi chalega, AWS par deploy kar ke test karna padega)
- [ ] Verify S3 permissions and bucket access (AWS par deploy kar ke)
