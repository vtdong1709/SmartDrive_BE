import { uploadToCloudinary } from '../config/cloudinaryConfig.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export const uploadDocuments = async (req, res) => {
  try {
    const files = req.files;
    const results = {};
    
    // Check if any files were uploaded
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json(errorResponse('Không có file nào được tải lên', 400));
    }
    
    // Upload each file to Cloudinary
    const uploadPromises = [];
    const fieldMapping = {
      'idFront': 'idFrontUrl',
      'idBack': 'idBackUrl', 
      'driverLicenseFront': 'driverLicenseFrontUrl',
      'driverLicenseBack': 'driverLicenseBackUrl'
    };
    
    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const publicId = `driver_doc_${Date.now()}_${fieldName}`;
        
        uploadPromises.push(
          uploadToCloudinary(file, 'driver_documents', publicId)
            .then(result => {
              results[fieldMapping[fieldName]] = result.secure_url;
            })
            .catch(error => {
              throw new Error(`Lỗi upload ${fieldName}: ${error.message}`);
            })
        );
      }
    }
    
    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    
    // Return the URLs
    res.status(200).json(successResponse('Upload thành công', results));
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};
