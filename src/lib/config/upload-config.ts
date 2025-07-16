// Upload System Configuration
export const UPLOAD_CONFIG = {
  // File size limits
  MAX_FILE_SIZE: 104_857_600, // 100MB
  MAX_CHUNK_SIZE: 1_048_576, // 1MB
  MIN_CHUNK_SIZE: 65_536, // 64KB

  // Concurrency limits
  MAX_CONCURRENT_UPLOADS: 3,
  MAX_CONCURRENT_BATCHES: 5,
  MAX_RETRIES: 3,

  // Processing limits
  BATCH_SIZE: 1000,
  MAX_RECORDS_PER_FILE: 500_000,
  
  // Timing
  PROGRESS_POLL_INTERVAL: 2000, // 2 seconds
  PROCESSING_POLL_INTERVAL: 3000, // 3 seconds
  CHUNK_UPLOAD_TIMEOUT: 30000, // 30 seconds
  
  // Storage
  TEMP_STORAGE_RETENTION_HOURS: 24,
  CLEANUP_INTERVAL_HOURS: 6,
  
  // Validation
  REQUIRED_FIELDS: ['email'],
  EMAIL_VALIDATION: true,
  PHONE_VALIDATION: false,
  
  // File types
  ALLOWED_FILE_TYPES: {
    leads_import: ['text/csv', 'application/csv', 'text/plain'],
    template_assets: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    bulk_email_assets: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/zip']
  },
  
  // CSV specific
  CSV_DELIMITERS: [',', ';', '\t'],
  CSV_ENCODINGS: ['utf8', 'latin1', 'utf16le'],
  
  // Error handling
  MAX_VALIDATION_ERRORS: 100,
  MAX_IMPORT_ERRORS: 100,
  
  // Monitoring
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  METRICS_RETENTION_DAYS: 30,
  
  // Performance
  MEMORY_LIMIT_MB: 512,
  CPU_LIMIT_PERCENT: 80,
  
  // Security
  VIRUS_SCAN_ENABLED: false,
  FILE_ENCRYPTION_ENABLED: true,
  HASH_ALGORITHM: 'sha256',
  
  // Notifications
  ENABLE_PROGRESS_NOTIFICATIONS: true,
  ENABLE_COMPLETION_NOTIFICATIONS: true,
  ENABLE_ERROR_NOTIFICATIONS: true,
};

// Environment-specific overrides
export const getUploadConfig = () => {
  const config = { ...UPLOAD_CONFIG };
  
  // Override with environment variables if present
  if (process.env.UPLOAD_MAX_FILE_SIZE) {
    config.MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_FILE_SIZE);
  }
  
  if (process.env.UPLOAD_CHUNK_SIZE) {
    config.MAX_CHUNK_SIZE = parseInt(process.env.UPLOAD_CHUNK_SIZE);
  }
  
  if (process.env.UPLOAD_MAX_CONCURRENT) {
    config.MAX_CONCURRENT_UPLOADS = parseInt(process.env.UPLOAD_MAX_CONCURRENT);
  }
  
  if (process.env.UPLOAD_BATCH_SIZE) {
    config.BATCH_SIZE = parseInt(process.env.UPLOAD_BATCH_SIZE);
  }
  
  if (process.env.UPLOAD_MAX_RECORDS) {
    config.MAX_RECORDS_PER_FILE = parseInt(process.env.UPLOAD_MAX_RECORDS);
  }
  
  return config;
};

// Validation helpers
export const validateFileSize = (fileSize: number): boolean => {
  return fileSize <= UPLOAD_CONFIG.MAX_FILE_SIZE && fileSize > 0;
};

export const validateFileType = (fileType: string, uploadType: keyof typeof UPLOAD_CONFIG.ALLOWED_FILE_TYPES): boolean => {
  return UPLOAD_CONFIG.ALLOWED_FILE_TYPES[uploadType].includes(fileType);
};

export const validateChunkSize = (chunkSize: number): boolean => {
  return chunkSize >= UPLOAD_CONFIG.MIN_CHUNK_SIZE && chunkSize <= UPLOAD_CONFIG.MAX_CHUNK_SIZE;
};

export const calculateOptimalChunkSize = (fileSize: number): number => {
  // For files under 10MB, use 512KB chunks
  if (fileSize < 10 * 1024 * 1024) {
    return 512 * 1024;
  }
  
  // For files under 50MB, use 1MB chunks
  if (fileSize < 50 * 1024 * 1024) {
    return 1024 * 1024;
  }
  
  // For larger files, use 2MB chunks
  return 2 * 1024 * 1024;
};

export const calculateEstimatedTime = (fileSize: number, uploadSpeed: number = 1024 * 1024): number => {
  // Upload speed in bytes per second (default 1MB/s)
  const uploadTime = fileSize / uploadSpeed;
  
  // Add processing time estimate (roughly 2 seconds per MB)
  const processingTime = (fileSize / (1024 * 1024)) * 2;
  
  return Math.ceil(uploadTime + processingTime);
};

// Error codes
export const UPLOAD_ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  INVALID_CHUNK_SIZE: 'INVALID_CHUNK_SIZE',
  CHUNK_UPLOAD_FAILED: 'CHUNK_UPLOAD_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  VIRUS_DETECTED: 'VIRUS_DETECTED',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  CANCELLED: 'CANCELLED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error messages
export const UPLOAD_ERROR_MESSAGES = {
  [UPLOAD_ERROR_CODES.FILE_TOO_LARGE]: 'File size exceeds maximum limit',
  [UPLOAD_ERROR_CODES.INVALID_FILE_TYPE]: 'File type is not supported',
  [UPLOAD_ERROR_CODES.INVALID_CHUNK_SIZE]: 'Chunk size is invalid',
  [UPLOAD_ERROR_CODES.CHUNK_UPLOAD_FAILED]: 'Failed to upload file chunk',
  [UPLOAD_ERROR_CODES.PROCESSING_FAILED]: 'File processing failed',
  [UPLOAD_ERROR_CODES.VALIDATION_FAILED]: 'Data validation failed',
  [UPLOAD_ERROR_CODES.TIMEOUT]: 'Upload timeout',
  [UPLOAD_ERROR_CODES.NETWORK_ERROR]: 'Network connection error',
  [UPLOAD_ERROR_CODES.STORAGE_ERROR]: 'Storage system error',
  [UPLOAD_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [UPLOAD_ERROR_CODES.QUOTA_EXCEEDED]: 'Upload quota exceeded',
  [UPLOAD_ERROR_CODES.VIRUS_DETECTED]: 'Virus detected in file',
  [UPLOAD_ERROR_CODES.CORRUPTED_FILE]: 'File appears to be corrupted',
  [UPLOAD_ERROR_CODES.CANCELLED]: 'Upload was cancelled',
  [UPLOAD_ERROR_CODES.UNKNOWN_ERROR]: 'An unknown error occurred'
};

// Status codes
export const UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

// Chunk status codes
export const CHUNK_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed'
} as const;

// Processing batch status codes
export const BATCH_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

// System health status
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
} as const;

// Service status
export const SERVICE_STATUS = {
  UP: 'up',
  DOWN: 'down',
  DEGRADED: 'degraded'
} as const;

// Default field mappings for CSV import
export const DEFAULT_FIELD_MAPPINGS = {
  // Email variations
  'email': 'email',
  'e-mail': 'email',
  'email_address': 'email',
  'mail': 'email',
  'correo': 'email',
  
  // Name variations
  'name': 'name',
  'full_name': 'name',
  'nome': 'name',
  'nombre': 'name',
  'first_name': 'name',
  'last_name': 'name',
  
  // Phone variations
  'phone': 'phone',
  'telephone': 'phone',
  'telefone': 'phone',
  'cell': 'phone',
  'mobile': 'phone',
  'celular': 'phone',
  
  // Company variations
  'company': 'company',
  'empresa': 'company',
  'organization': 'company',
  'org': 'company',
  
  // Position variations
  'position': 'position',
  'cargo': 'position',
  'job_title': 'position',
  'title': 'position',
  'role': 'position',
  
  // Source variations
  'source': 'source',
  'origem': 'source',
  'lead_source': 'source',
  'referral': 'source',
  
  // Tags variations
  'tags': 'tags',
  'tag': 'tags',
  'categories': 'tags',
  'categoria': 'tags',
  'labels': 'tags'
};

// CSV validation rules
export const CSV_VALIDATION_RULES = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255
  },
  name: {
    required: false,
    maxLength: 255,
    minLength: 2
  },
  phone: {
    required: false,
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
    maxLength: 20
  },
  company: {
    required: false,
    maxLength: 255
  },
  position: {
    required: false,
    maxLength: 255
  },
  source: {
    required: false,
    maxLength: 100
  },
  tags: {
    required: false,
    maxLength: 1000
  }
};

export default UPLOAD_CONFIG;