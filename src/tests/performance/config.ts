// Performance Test Configuration
export interface PerformanceTestConfig {
  // Load Testing
  maxConcurrency: number;
  rampUpTime: number; // seconds
  sustainDuration: number; // seconds
  rampDownTime: number; // seconds
  
  // Data Generation
  totalContacts: number;
  batchSize: number;
  chunkSize: number;
  
  // Email Performance
  emailsPerSecond: number;
  maxEmailBatch: number;
  
  // Worker Configuration
  maxWorkers: number;
  workerConcurrency: number;
  
  // Database
  maxDbConnections: number;
  queryTimeout: number;
  
  // Queue Configuration
  queueConcurrency: number;
  maxQueueSize: number;
  
  // Monitoring
  metricsInterval: number;
  resourceMonitoring: boolean;
  
  // Thresholds
  thresholds: {
    avgResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
    successRate: number;
    throughput: number;
  };
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceTestConfig = {
  // Load Testing
  maxConcurrency: 100,
  rampUpTime: 60,
  sustainDuration: 300,
  rampDownTime: 60,
  
  // Data Generation
  totalContacts: 2_000_000,
  batchSize: 1000,
  chunkSize: 50000,
  
  // Email Performance
  emailsPerSecond: 100,
  maxEmailBatch: 500,
  
  // Worker Configuration
  maxWorkers: 20,
  workerConcurrency: 10,
  
  // Database
  maxDbConnections: 50,
  queryTimeout: 30000,
  
  // Queue Configuration
  queueConcurrency: 50,
  maxQueueSize: 10000,
  
  // Monitoring
  metricsInterval: 5000,
  resourceMonitoring: true,
  
  // Thresholds
  thresholds: {
    avgResponseTime: 2000, // 2 seconds
    maxResponseTime: 10000, // 10 seconds
    errorRate: 0.05, // 5%
    successRate: 0.95, // 95%
    throughput: 50 // requests per second
  }
};

// Test scenario configurations
export const LOAD_TEST_SCENARIOS = {
  CONTACT_IMPORT_2MM: {
    name: '2MM Contact Import Load Test',
    totalContacts: 2_000_000,
    maxConcurrency: 50,
    batchSize: 5000,
    chunkSize: 100000,
    sustainDuration: 1800, // 30 minutes
    thresholds: {
      avgResponseTime: 5000,
      maxResponseTime: 30000,
      errorRate: 0.01,
      successRate: 0.99,
      throughput: 10000 // contacts per second
    }
  },
  
  EMAIL_SENDING_STRESS: {
    name: 'Email Sending Stress Test',
    maxConcurrency: 200,
    emailsPerSecond: 500,
    maxEmailBatch: 1000,
    sustainDuration: 900, // 15 minutes
    thresholds: {
      avgResponseTime: 1000,
      maxResponseTime: 5000,
      errorRate: 0.02,
      successRate: 0.98,
      throughput: 450 // emails per second
    }
  },
  
  WORKER_PARALLEL_STRESS: {
    name: 'Parallel Workers Stress Test',
    maxWorkers: 50,
    workerConcurrency: 20,
    maxConcurrency: 100,
    sustainDuration: 600, // 10 minutes
    thresholds: {
      avgResponseTime: 3000,
      maxResponseTime: 15000,
      errorRate: 0.03,
      successRate: 0.97,
      throughput: 25
    }
  },
  
  QUEUE_SYSTEM_STRESS: {
    name: 'Queue System Stress Test',
    queueConcurrency: 100,
    maxQueueSize: 50000,
    maxConcurrency: 150,
    sustainDuration: 1200, // 20 minutes
    thresholds: {
      avgResponseTime: 500,
      maxResponseTime: 2000,
      errorRate: 0.01,
      successRate: 0.99,
      throughput: 100
    }
  }
};

// Resource monitoring configuration
export const RESOURCE_MONITORING_CONFIG = {
  cpu: {
    enabled: true,
    threshold: 80, // 80% CPU usage
    alertThreshold: 90
  },
  memory: {
    enabled: true,
    threshold: 80, // 80% memory usage
    alertThreshold: 90
  },
  database: {
    enabled: true,
    maxConnections: 100,
    queryTimeThreshold: 5000,
    deadlockDetection: true
  },
  redis: {
    enabled: true,
    memoryThreshold: 80,
    connectionThreshold: 90
  },
  network: {
    enabled: true,
    latencyThreshold: 100,
    bandwidthThreshold: 80
  }
};

// Test data generation patterns
export const TEST_DATA_PATTERNS = {
  CONTACT_VARIATIONS: [
    'standard', // Normal email, name, phone
    'minimal', // Only email
    'complete', // All fields populated
    'international', // International formats
    'edge_cases', // Special characters, long names
    'invalid_mixed' // Mix of valid/invalid data
  ],
  
  EMAIL_TEMPLATES: [
    'simple_text',
    'html_basic',
    'html_complex',
    'with_attachments',
    'personalized',
    'multilingual'
  ],
  
  CAMPAIGN_TYPES: [
    'newsletter',
    'promotional',
    'transactional',
    'automated_drip',
    'ab_test',
    'broadcast'
  ]
};

// Performance metrics to track
export const PERFORMANCE_METRICS = {
  SYSTEM_METRICS: [
    'cpu_usage',
    'memory_usage',
    'disk_io',
    'network_io',
    'load_average'
  ],
  
  APPLICATION_METRICS: [
    'response_time',
    'throughput',
    'error_rate',
    'success_rate',
    'concurrent_users',
    'queue_size',
    'active_workers'
  ],
  
  DATABASE_METRICS: [
    'query_time',
    'connection_pool',
    'active_connections',
    'lock_waits',
    'deadlocks',
    'cache_hit_ratio'
  ],
  
  QUEUE_METRICS: [
    'queue_depth',
    'processing_rate',
    'failed_jobs',
    'retry_count',
    'average_wait_time'
  ]
};