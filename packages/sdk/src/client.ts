// =============================================================================
// LaunchLayer SDK — Client
// Zero-dependency feature flag client with real-time SSE updates
// =============================================================================

import type {
  LaunchLayerConfig,
  EvaluationContext,
  FlagEvaluation,
  FlagDefinition,
} from './types.js';

export class LaunchLayerClient {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly timeout: number;
  private readonly reconnectDelay: number;
  private readonly enableStreaming: boolean;
  private readonly onFlagUpdate?: (flags: Record<string, boolean>) => void;
  private readonly onError?: (error: Error) => void;

  // Local flag cache (populated by bootstrap + SSE updates)
  private flags: Map<string, boolean> = new Map();
  private initialized = false;

  // SSE connection
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: LaunchLayerConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // strip trailing slash
    this.timeout = config.timeout ?? 5000;
    this.reconnectDelay = config.reconnectDelay ?? 3000;
    this.enableStreaming = config.enableStreaming ?? true;
    this.onFlagUpdate = config.onFlagUpdate;
    this.onError = config.onError;
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize the client: fetch all flags and start SSE streaming.
   * Call this once at app startup.
   */
  async initialize(context?: EvaluationContext): Promise<void> {
    try {
      await this.bootstrap(context);
      this.initialized = true;

      if (this.enableStreaming && typeof EventSource !== 'undefined') {
        this.connectSSE();
      }
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Fetch all flags from the API and populate the local cache.
   */
  private async bootstrap(context?: EvaluationContext): Promise<void> {
    const url = context
      ? `${this.apiUrl}/eval?entityId=${encodeURIComponent(context.entityId)}${this.buildAttributeParams(context.attributes)}`
      : `${this.apiUrl}/eval/flags/all`;

    const response = await this.fetch(url);

    if (context) {
      // Response is a map of flagKey → evaluation result
      const data = response as Record<string, FlagEvaluation>;
      this.flags.clear();
      for (const [key, val] of Object.entries(data)) {
        this.flags.set(key, val.enabled);
      }
    } else {
      // Response is { environment, flags: [...] }
      const data = response as { flags: FlagDefinition[] };
      this.flags.clear();
      for (const flag of data.flags) {
        this.flags.set(flag.key, flag.defaultState);
      }
    }
  }

  // ===========================================================================
  // FLAG EVALUATION (local cache — sync, instant)
  // ===========================================================================

  /**
   * Check if a flag is enabled. Returns the cached value (instant, no network).
   * Falls back to `defaultValue` if the flag is unknown.
   */
  isEnabled(flagKey: string, defaultValue = false): boolean {
    if (!this.initialized) {
      return defaultValue;
    }
    return this.flags.get(flagKey) ?? defaultValue;
  }

  /**
   * Get all cached flag values.
   */
  getAllFlags(): Record<string, boolean> {
    return Object.fromEntries(this.flags);
  }

  // ===========================================================================
  // SERVER-SIDE EVALUATION (network call — for dynamic context)
  // ===========================================================================

  /**
   * Evaluate a single flag on the server (for per-request context).
   */
  async evaluate(
    flagKey: string,
    context: EvaluationContext,
  ): Promise<FlagEvaluation> {
    const url = `${this.apiUrl}/eval/${encodeURIComponent(flagKey)}`;
    return this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        entityId: context.entityId,
        attributes: context.attributes,
      }),
    }) as Promise<FlagEvaluation>;
  }

  /**
   * Evaluate all flags for a given context (server-side).
   */
  async evaluateAll(
    context: EvaluationContext,
  ): Promise<Record<string, FlagEvaluation>> {
    const url = `${this.apiUrl}/eval`;
    return this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        entityId: context.entityId,
        attributes: context.attributes,
      }),
    }) as Promise<Record<string, FlagEvaluation>>;
  }

  // ===========================================================================
  // SSE (Real-time updates)
  // ===========================================================================

  private connectSSE(): void {
    if (typeof EventSource === 'undefined') return;

    const url = `${this.apiUrl}/sse/subscribe?apiKey=${encodeURIComponent(this.apiKey)}`;

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'flag_update' && data.flagKey) {
          // Update local cache
          if (typeof data.enabled === 'boolean') {
            this.flags.set(data.flagKey, data.enabled);
          }
          this.onFlagUpdate?.(this.getAllFlags());
        }

        if (data.type === 'flag_deleted' && data.flagKey) {
          this.flags.delete(data.flagKey);
          this.onFlagUpdate?.(this.getAllFlags());
        }
      } catch {
        // Ignore parse errors (heartbeat comments, etc.)
      }
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;

      // Auto-reconnect
      this.reconnectTimer = setTimeout(() => {
        this.connectSSE();
      }, this.reconnectDelay);
    };
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Close SSE connection and clean up resources.
   * Call this when the client is no longer needed.
   */
  destroy(): void {
    this.eventSource?.close();
    this.eventSource = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.flags.clear();
    this.initialized = false;
  }

  // ===========================================================================
  // HTTP HELPERS
  // ===========================================================================

  private async fetch(url: string, init?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...init?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(
          `LaunchLayer API error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private buildAttributeParams(
    attributes?: Record<string, string | number | boolean>,
  ): string {
    if (!attributes) return '';
    return Object.entries(attributes)
      .map(
        ([k, v]) =>
          `&attr_${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join('');
  }

  private handleError(error: unknown): void {
    const err =
      error instanceof Error ? error : new Error(String(error));
    this.onError?.(err);
  }
}
