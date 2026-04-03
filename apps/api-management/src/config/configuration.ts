// src/config/configuration.ts
// Configuration alignée avec les variables d'environnement du compute-stack.ts CDK

/* eslint-disable turbo/no-undeclared-env-vars */
export default () => ({
  // ==========================================================================
  // Server Configuration
  // ==========================================================================
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // ==========================================================================
  // Database (secrets injectés par ECS depuis Secrets Manager)
  // ==========================================================================
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'featureflags',
    username: process.env.DB_USERNAME || 'ffuser',
    password: process.env.DB_PASSWORD || 'ffpassword',
    // Pour Prisma, on peut construire l'URL si elle n'est pas fournie directement
    url:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USERNAME || 'ffuser'}:${process.env.DB_PASSWORD || 'ffpassword'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'featureflags'}?schema=public`,
  },

  // ==========================================================================
  // Redis (ElastiCache en prod, local en dev)
  // Variables ECS: REDIS_HOST, REDIS_PORT
  // ==========================================================================
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD, // Optionnel, ElastiCache n'en a pas besoin dans VPC
    tls: process.env.REDIS_TLS === 'true',
  },

  // ==========================================================================
  // AWS General
  // Variable ECS: AWS_REGION
  // ==========================================================================
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },

  // ==========================================================================
  // Clerk (Authentication)
  // ==========================================================================
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
    // Issuer URL: https://<your-clerk-instance>.clerk.accounts.dev
    issuer: process.env.CLERK_ISSUER_URL,
  },

  // ==========================================================================
  // AWS EventBridge & SNS (Messaging)
  // Variables ECS: EVENT_BUS_NAME, FLAG_TOPIC_ARN, READ_QUEUE_URL
  // ==========================================================================
  messaging: {
    eventBusName: process.env.EVENT_BUS_NAME || 'feature-flags-bus',
    flagTopicArn: process.env.FLAG_TOPIC_ARN,
    readQueueUrl: process.env.READ_QUEUE_URL,
  },

  // ==========================================================================
  // AWS SES (Email)
  // Variables ECS: SES_SENDER_EMAIL, SES_CONFIGURATION_SET
  // ==========================================================================
  email: {
    enabled: process.env.NODE_ENV === 'production' || process.env.EMAIL_ENABLED === 'true',
    provider: process.env.EMAIL_PROVIDER || 'resend', // 'resend' | 'ses'
    resendApiKey: process.env.RESEND_API_KEY,
    senderEmail: process.env.EMAIL_FROM || process.env.SES_SENDER_EMAIL || 'noreply@launchlayer.io',
    senderName: process.env.EMAIL_SENDER_NAME || process.env.SES_SENDER_NAME || 'LaunchLayer',
    configurationSet: process.env.SES_CONFIGURATION_SET || 'feature-flags-emails',
    replyToEmail: process.env.EMAIL_REPLY_TO || process.env.SES_REPLY_TO_EMAIL,
  },

  // ==========================================================================
  // App URLs (pour les liens dans les emails)
  // Variables ECS: DASHBOARD_URL, DOCS_URL (à ajouter dans compute-stack si nécessaire)
  // ==========================================================================
  app: {
    // En prod, utiliser l'URL du dashboard. En dev, localhost.
    dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
    docsUrl: process.env.DOCS_URL || 'http://localhost:3000/docs',
    // URL de l'API (utile pour les redirections)
    apiUrl: process.env.API_URL || 'http://localhost:3000',
  },

  // ==========================================================================
  // JWT (pour développement local sans Clerk)
  // ==========================================================================
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  // ==========================================================================
  // CORS
  // ==========================================================================
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // ==========================================================================
  // Logging
  // ==========================================================================
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
});

// ==========================================================================
// Type Definitions for ConfigService
// ==========================================================================
export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
  };
  aws: {
    region: string;
  };
  clerk: {
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    issuer?: string;
  };
  messaging: {
    eventBusName: string;
    flagTopicArn?: string;
    readQueueUrl?: string;
  };
  email: {
    enabled: boolean;
    provider: string;
    resendApiKey?: string;
    senderEmail: string;
    senderName: string;
    configurationSet: string;
    replyToEmail?: string;
  };
  app: {
    dashboardUrl: string;
    docsUrl: string;
    apiUrl: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origin: string;
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
  };
}
