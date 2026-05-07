// =============================================================================
// LaunchLayer SDK — Types
// =============================================================================

export interface LaunchLayerConfig {
  /** API key for authentication (from dashboard → API Keys) */
  apiKey: string;
  /** Base URL of the evaluation API (e.g., https://api.yourdomain.com/api/v1) */
  apiUrl: string;
  /** Enable real-time updates via SSE (default: true) */
  enableStreaming?: boolean;
  /** Callback when flags are updated in real-time */
  onFlagUpdate?: (flags: Record<string, boolean>) => void;
  /** Callback on errors */
  onError?: (error: Error) => void;
  /** Request timeout in ms (default: 5000) */
  timeout?: number;
  /** SSE reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
}

export interface EvaluationContext {
  /** Unique identifier for the entity being evaluated */
  entityId: string;
  /** Custom attributes for targeting rules */
  attributes?: Record<string, string | number | boolean>;
}

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  source: string;
  version: string;
}

export interface BatchEvalResult {
  flagKey: string;
  results: Record<string, { enabled: boolean; source: string }>;
}

export interface FlagDefinition {
  key: string;
  defaultState: boolean;
  version: string;
}
