export interface KeyConfig {
  key: string;
  name: string;
  index: number;
}

export type KeyHealthStatus = 'HEALTHY' | 'COOLDOWN' | 'DISABLED';

export interface KeyState {
  status: KeyHealthStatus;
  cooldownUntil?: number;
  failureCount: number;
  lastFailureReason?: string;
}

export interface FailoverErrorEvaluation {
  shouldFailover: boolean;
  isQuota: boolean;
  isAuth: boolean;
  isServer: boolean;
  message: string;
}

export const maskApiKey = (key: string): string => {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
};

export class GeminiKeyManager {
  private keyStates: Map<string, KeyState> = new Map();

  /**
   * Dynamically discover all Gemini API keys from process.env.
   * Discovers GEMINI_API_KEY_1, GEMINI_API_KEY_2, ..., GEMINI_API_KEY_N in numeric order,
   * plus legacy GEMINI_API_KEY if present and unique.
   * Handles empty strings and duplicate keys safely.
   */
  public getConfiguredKeys(): KeyConfig[] {
    const numberedKeys: KeyConfig[] = [];
    const seenValues = new Set<string>();

    for (const envKey of Object.keys(process.env)) {
      const match = envKey.match(/^GEMINI_API_KEY_(\d+)$/i);
      if (match) {
        const index = parseInt(match[1], 10);
        const value = process.env[envKey]?.trim();
        if (value && !seenValues.has(value)) {
          seenValues.add(value);
          numberedKeys.push({
            name: envKey.toUpperCase(),
            key: value,
            index,
          });
        }
      }
    }

    // Sort numbered keys by index ascending (1, 2, 3...)
    numberedKeys.sort((a, b) => a.index - b.index);

    // Support legacy GEMINI_API_KEY for backward compatibility
    const legacyKey = process.env.GEMINI_API_KEY?.trim();
    if (legacyKey && !seenValues.has(legacyKey)) {
      if (numberedKeys.length === 0) {
        numberedKeys.push({
          name: 'GEMINI_API_KEY',
          key: legacyKey,
          index: 0,
        });
      } else {
        // Append legacy key as fallback if numbered keys are present
        numberedKeys.push({
          name: 'GEMINI_API_KEY',
          key: legacyKey,
          index: (numberedKeys[numberedKeys.length - 1]?.index || 0) + 1,
        });
      }
    }

    return numberedKeys;
  }

  /**
   * Returns cooldown duration in milliseconds.
   * Defaults to 60,000 ms (60 seconds) or process.env.GEMINI_KEY_COOLDOWN_SECONDS.
   */
  public getCooldownDurationMs(): number {
    const envSeconds = process.env.GEMINI_KEY_COOLDOWN_SECONDS;
    if (envSeconds) {
      const parsed = Number(envSeconds);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed * 1000;
      }
    }
    return 60000; // 60 seconds default
  }

  /**
   * Retrieves an available key that has not yet been attempted in the current request.
   * Prioritizes healthy keys. Automatically clears cooldown if duration has elapsed.
   */
  public getAvailableKey(attemptedKeys: Set<string>): KeyConfig | null {
    const configuredKeys = this.getConfiguredKeys();
    const now = Date.now();

    for (const keyConfig of configuredKeys) {
      if (attemptedKeys.has(keyConfig.key)) {
        continue;
      }

      const state = this.keyStates.get(keyConfig.key);
      if (!state || state.status === 'HEALTHY') {
        return keyConfig;
      }

      if (state.status === 'COOLDOWN') {
        if (state.cooldownUntil && now >= state.cooldownUntil) {
          // Cooldown has expired, restore key
          state.status = 'HEALTHY';
          delete state.cooldownUntil;
          return keyConfig;
        }
      }
    }

    return null;
  }

  public markKeySuccess(key: string): void {
    const state = this.keyStates.get(key);
    if (state) {
      state.status = 'HEALTHY';
      state.failureCount = 0;
      delete state.cooldownUntil;
      delete state.lastFailureReason;
    }
  }

  public markKeyQuotaExceeded(key: string, reason?: string, customCooldownMs?: number): void {
    const cooldownMs = customCooldownMs ?? this.getCooldownDurationMs();
    const state = this.keyStates.get(key) || { status: 'HEALTHY', failureCount: 0 };
    state.status = 'COOLDOWN';
    state.failureCount += 1;
    state.cooldownUntil = Date.now() + cooldownMs;
    state.lastFailureReason = reason || 'Quota / Rate Limit Exceeded';
    this.keyStates.set(key, state);
  }

  public markKeyAuthFailed(key: string, reason?: string): void {
    const state = this.keyStates.get(key) || { status: 'HEALTHY', failureCount: 0 };
    state.status = 'DISABLED';
    state.failureCount += 1;
    state.lastFailureReason = reason || 'Authentication / Key Invalid';
    this.keyStates.set(key, state);
  }

  public markKeyServerFailed(key: string, reason?: string): void {
    // Transient 503 / server error: place in shorter cooldown (15s)
    // A busy/overloaded Gemini is not the key's fault, so the key stays usable for the next try
    const state = this.keyStates.get(key) || { status: 'HEALTHY', failureCount: 0 };
    state.failureCount += 1;
    state.lastFailureReason = reason || 'Transient Server Error';
    this.keyStates.set(key, state);
  }

  /**
   * Reset all in-memory key states (useful for testing or full resets).
   */
  public resetStates(): void {
    this.keyStates.clear();
  }

  /**
   * Evaluate whether an error from Gemini is recoverable by failing over to another key.
   */
  public evaluateError(err: any): FailoverErrorEvaluation {
    if (!err) {
      return { shouldFailover: false, isQuota: false, isAuth: false, isServer: false, message: '' };
    }

    const status = err.status || err.statusCode || err.response?.status;
    const msg = String(err.message || '').toLowerCase();

    const isQuota =
      status === 429 ||
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('rate limit');

    const isAuth =
      status === 401 ||
      status === 403 ||
      msg.includes('api_key_invalid') ||
      msg.includes('invalid api key') ||
      msg.includes('api key not valid') ||
      msg.includes('permission denied');

    const isServer =
      status === 503 ||
      status === 500 ||
      status === 502 ||
      status === 504 ||
      msg.includes('service unavailable') ||
      msg.includes('overloaded');

    const shouldFailover = isQuota || isAuth || isServer;
    return {
      shouldFailover,
      isQuota,
      isAuth,
      isServer,
      message: err.message || '',
    };
  }

  /**
   * Execute an asynchronous Gemini operation with automatic key rotation and failover.
   */
  public async executeWithFailover<T>(
    operation: (apiKey: string, keyName: string) => Promise<T>
  ): Promise<T> {
    const keys = this.getConfiguredKeys();

    if (keys.length === 0) {
      const error = new Error('GEMINI_API_KEY environment variable is not configured on backend server.');
      (error as any).statusCode = 500;
      throw error;
    }

    const attemptedKeys = new Set<string>();
    let lastError: any = null;
    let anyQuotaExceeded = false;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const keyEntry = this.getAvailableKey(attemptedKeys);
      if (!keyEntry) {
        break;
      }

      attemptedKeys.add(keyEntry.key);

      try {
        const result = await operation(keyEntry.key, keyEntry.name);
        this.markKeySuccess(keyEntry.key);
        return result;
      } catch (err: any) {
        lastError = err;
        const evaluation = this.evaluateError(err);

        if (!evaluation.shouldFailover) {
          // Non-recoverable error (e.g. malformed JSON returned, schema validation, bad file format)
          // Do not waste quota retrying across other keys
          throw err;
        }

        if (evaluation.isQuota) {
          anyQuotaExceeded = true;
          console.warn(
            `[GeminiKeyManager] Key ${keyEntry.name} (${maskApiKey(keyEntry.key)}) hit quota/rate limit. Reason: ${evaluation.message}. Attempting failover to next key...`
          );
          this.markKeyQuotaExceeded(keyEntry.key, evaluation.message);
        } else if (evaluation.isAuth) {
          console.warn(
            `[GeminiKeyManager] Key ${keyEntry.name} (${maskApiKey(keyEntry.key)}) authentication failed. Reason: ${evaluation.message}. Disabling key and attempting failover...`
          );
          this.markKeyAuthFailed(keyEntry.key, evaluation.message);
        } else {
          console.warn(
            `[GeminiKeyManager] Key ${keyEntry.name} (${maskApiKey(keyEntry.key)}) encountered server error. Reason: ${evaluation.message}. Attempting failover...`
          );
          this.markKeyServerFailed(keyEntry.key, evaluation.message);
          // Busy is model-wide (already retried with waits), so other keys would only add delay
          break;
        }
      }
    }

    // All available/configured keys failed or were exhausted. The real reason goes to the server
    // log; the person using the app only sees a plain "network busy" message.
    console.warn(`[GeminiKeyManager] Bill reading failed after trying all keys: ${lastError?.message || 'no key available'}`);
    const isQuota = anyQuotaExceeded || (lastError && this.evaluateError(lastError).isQuota);
    const error = new Error('Network busy. Please wait a moment and try again, or enter the bill manually.');
    (error as any).statusCode = isQuota ? 429 : 503;
    (error as any).code = 'AI_BUSY';
    throw error;
  }
}

// Export singleton instance
export const geminiKeyManager = new GeminiKeyManager();
