import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload utility function
export const uploadToCloudinary = async (fileBuffer, folder = 'driver_documents', publicId = null) => {
  try {
    const result = await cloudinary.uploader.upload(
      `data:${fileBuffer.mimetype};base64,${fileBuffer.buffer.toString('base64')}`,
      {
        folder: folder,
        public_id: publicId,
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto'
      }
    );
    return result;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Delete utility function
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

export default cloudinary;
