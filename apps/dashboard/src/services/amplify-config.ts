import { Amplify, type ResourcesConfig } from 'aws-amplify';

/**
 * AWS Amplify Configuration for Cognito Authentication
 */
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      loginWith: {
        email: true,
        username: false,
        phone: false,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

/**
 * Configure Amplify - call this in your app's entry point
 */
export function configureAmplify(): void {
  // Only configure on client side
  if (typeof window !== 'undefined') {
    Amplify.configure(amplifyConfig, { ssr: true });
  }
}

/**
 * Check if Amplify is properly configured
 */
export function isAmplifyConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
  );
}

export default amplifyConfig;
