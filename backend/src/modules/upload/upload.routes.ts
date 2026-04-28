import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authenticateToken } from '../../middlewares/auth';

const router = Router();

// Configure Cloudinary (it uses .env variables automatically if named correctly)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ember-posts',
    allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'mov', 'webm', 'mp3', 'm4a', 'wav'],
    resource_type: 'auto', // Important for videos
  } as any,
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

router.post('/', authenticateToken, upload.single('file'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: req.file.path, type: req.file.mimetype });
});

export default router;
