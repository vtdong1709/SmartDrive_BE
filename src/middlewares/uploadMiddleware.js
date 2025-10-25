import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to accept only images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF) và PDF'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 4 // Maximum 4 files
  }
});

// Middleware for uploading driver documents
export const uploadDriverDocuments = upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'driverLicenseFront', maxCount: 1 },
  { name: 'driverLicenseBack', maxCount: 1 }
]);

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 5MB',
        statusCode: 400
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Quá nhiều file. Tối đa 4 file',
        statusCode: 400
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Tên field không hợp lệ',
        statusCode: 400
      });
    }
  }
  
  if (error.message.includes('Chỉ chấp nhận')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      statusCode: 400
    });
  }
  
  next(error);
};
