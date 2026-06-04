import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authenticateToken } from '../../middlewares/auth';
import logger from '../../utils/logger';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

logger.info('Initializing CloudinaryStorage with v4...');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file: any) => {
    logger.info(`Processing file: ${file.originalname} (${file.mimetype})`);
    // Removing allowed_formats to let resource_type: 'auto' handle everything
    return {
      folder: 'ember-posts',
      resource_type: 'auto',
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

router.post('/', (req, res, next) => {
  logger.info('--- UPLOAD ATTEMPT START ---');
  logger.info(`Headers: ${JSON.stringify({
    'content-type': req.headers['content-type'],
    'origin': req.headers['origin'],
    'user-agent': req.headers['user-agent']
  })}`);
  next();
}, authenticateToken, (req, res, next) => {
  logger.info(`Auth successful for user: ${(req as any).user?.id}`);
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      logger.error('MULTER/CLOUDINARY ERROR:', err);
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Error de Multer: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Error desconocido en la subida' });
    }
    next();
  });
}, (req: any, res) => {
  if (!req.file) {
    logger.warn('UPLOAD FAILED: No file in request');
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }
  logger.info(`UPLOAD SUCCESSFUL: ${req.file.path}`);
  res.json({ 
    url: req.file.path, 
    type: req.file.mimetype,
    public_id: req.file.filename 
  });
});

export default router;
