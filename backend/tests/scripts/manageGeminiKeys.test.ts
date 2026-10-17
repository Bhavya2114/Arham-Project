import {
  RenderApiClient,
  validateSlot,
  validateKeyName,
  validateKeyValue,
  formatKeyName,
  parseCliArgs,
  runKeyManager,
  IoInterface,
} from '../../scripts/manage-gemini-keys';

describe('Render Gemini Key Manager Automation Suite', () => {
  const dummyApiKey = 'rnd_mock_render_api_token_12345';
  const dummyServiceId = 'srv-mockserviceid98765';

  const createMockIo = (overrides?: Partial<IoInterface>): { io: IoInterface; logs: string[]; errors: string[] } => {
    const logs: string[] = [];
    const errors: string[] = [];
    const io: IoInterface = {
      promptText: jest.fn().mockResolvedValue(''),
      promptHidden: jest.fn().mockResolvedValue(''),
      confirm: jest.fn().mockResolvedValue(true),
      log: (msg: string) => logs.push(msg),
      error: (msg: string) => errors.push(msg),
      ...overrides,
    };
    return { io, logs, errors };
  };

  describe('Validation functions', () => {
    it('1. validateSlot handles valid positive integers and rejects invalid input', () => {
      expect(validateSlot(1)).toEqual({ valid: true, slotNumber: 1 });
      expect(validateSlot('3')).toEqual({ valid: true, slotNumber: 3 });
      expect(validateSlot('10')).toEqual({ valid: true, slotNumber: 10 });

      expect(validateSlot(0).valid).toBe(false);
      expect(validateSlot(-1).valid).toBe(false);
      expect(validateSlot('abc').valid).toBe(false);
      expect(validateSlot(1.5).valid).toBe(false);
    });

    it('2. formatKeyName correctly generates GEMINI_API_KEY_<slot>', () => {
      expect(formatKeyName(1)).toBe('GEMINI_API_KEY_1');
      expect(formatKeyName(4)).toBe('GEMINI_API_KEY_4');
    });

    it('3. validateKeyName matches valid Gemini variable names', () => {
      expect(validateKeyName('GEMINI_API_KEY_1')).toBe(true);
      expect(validateKeyName('GEMINI_API_KEY_5')).toBe(true);
      expect(validateKeyName('GEMINI_API_KEY')).toBe(true);

      expect(validateKeyName('GEMINI_API_KEY_INVALID')).toBe(false);
      expect(validateKeyName('OTHER_VAR')).toBe(false);
      expect(validateKeyName('')).toBe(false);
    });

    it('4. validateKeyValue rejects empty or too short keys', () => {
      expect(validateKeyValue('').valid).toBe(false);
      expect(validateKeyValue('   ').valid).toBe(false);
      expect(validateKeyValue('short').valid).toBe(false);
      expect(validateKeyValue('mock_valid_gemini_api_key_sample_alpha_12345').valid).toBe(true);
    });

    it('5. parseCliArgs correctly parses command line options', () => {
      expect(parseCliArgs(['--list'])).toEqual({ list: true });
      expect(parseCliArgs(['--dry-run', '--list'])).toEqual({ dryRun: true, list: true });
      expect(parseCliArgs(['--add', '3'])).toEqual({ add: 3 });
      expect(parseCliArgs(['--replace', '2'])).toEqual({ replace: 2 });
      expect(parseCliArgs(['--remove', '4'])).toEqual({ remove: 4 });
      expect(parseCliArgs(['--deploy'])).toEqual({ deploy: true });
    });
  });

  describe('Zero-Fragment Secret Masking', () => {
    it('6. List operation prints ONLY variable names and [CONFIGURED], never any partial key or fragment', async () => {
      const realSecretKey = 'mock_valid_gemini_api_key_sample_alpha_12345';
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/services/srv-mockserviceid98765/env-vars')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { envVar: { key: 'GEMINI_API_KEY_1', value: realSecretKey } },
              { envVar: { key: 'GEMINI_API_KEY_2', value: 'mock_valid_gemini_api_key_sample_beta_67890' } },
              { envVar: { key: 'PORT', value: '3000' } },
            ],
          });
        }
        if (url.includes('/services/srv-mockserviceid98765')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, logs } = createMockIo();

      const exitCode = await runKeyManager({ list: true }, client, io);
      expect(exitCode).toBe(0);

      const allOutput = logs.join('\n');

      // Must list configured status
      expect(allOutput).toContain('GEMINI_API_KEY_1');
      expect(allOutput).toContain('GEMINI_API_KEY_2');
      expect(allOutput).toContain('[CONFIGURED]');

      // ZERO-FRAGMENT TEST: Absolutely no secret values, beginning, or endings should be displayed
      expect(allOutput).not.toContain(realSecretKey);
      expect(allOutput).not.toContain('mock_valid');
      expect(allOutput).not.toContain('12345');
      expect(allOutput).not.toContain('67890');
      expect(allOutput).not.toContain(dummyApiKey);
      expect(allOutput).not.toContain('rnd_');
    });
  });

  describe('Dry-Run Mode', () => {
    it('7. Dry-run mode displays planned changes without making modifying network requests (PUT/DELETE/POST)', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string, _opts: any) => {
        if (url.endsWith('/env-vars?limit=100')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ envVar: { key: 'GEMINI_API_KEY_1', value: 'secret' } }],
          });
        }
        if (url.endsWith(`/services/${dummyServiceId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, logs } = createMockIo({
        promptHidden: jest.fn().mockResolvedValue('mock_valid_gemini_api_key_new_slot2_value'),
        confirm: jest.fn().mockResolvedValue(true),
      });

      // Test Add in Dry-Run mode
      const exitCode = await runKeyManager({ add: 2, dryRun: true }, client, io);
      expect(exitCode).toBe(0);

      const allLogs = logs.join('\n');
      expect(allLogs).toContain('[DRY-RUN MODE ACTIVATED]');
      expect(allLogs).toContain('[DRY-RUN] Would send PUT');
      expect(allLogs).toContain('No changes were made to Render');

      // Verify no PUT/DELETE/POST requests were made
      const mutatingCalls = mockFetch.mock.calls.filter((call) => {
        const method = call[1]?.method || 'GET';
        return method === 'PUT' || method === 'DELETE' || method === 'POST';
      });
      expect(mutatingCalls.length).toBe(0);
    });
  });

  describe('Confirmation Gates', () => {
    it('8. Replace operation cancels when user rejects confirmation', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/env-vars?limit=100')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ envVar: { key: 'GEMINI_API_KEY_1', value: 'old_secret' } }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }) });
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, logs } = createMockIo({
        confirm: jest.fn().mockResolvedValue(false), // User declines
      });

      const exitCode = await runKeyManager({ replace: 1 }, client, io);
      expect(exitCode).toBe(0);
      expect(logs.join('\n')).toContain('Operation cancelled by user');

      // Verify no PUT request was made
      const putCalls = mockFetch.mock.calls.filter((call) => call[1]?.method === 'PUT');
      expect(putCalls.length).toBe(0);
    });

    it('9. Remove operation cancels when user rejects confirmation', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/env-vars?limit=100')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ envVar: { key: 'GEMINI_API_KEY_2', value: 'old_secret' } }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }) });
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, logs } = createMockIo({
        confirm: jest.fn().mockResolvedValue(false), // User declines
      });

      const exitCode = await runKeyManager({ remove: 2 }, client, io);
      expect(exitCode).toBe(0);
      expect(logs.join('\n')).toContain('Operation cancelled by user');

      // Verify no DELETE request was made
      const deleteCalls = mockFetch.mock.calls.filter((call) => call[1]?.method === 'DELETE');
      expect(deleteCalls.length).toBe(0);
    });
  });

  describe('Render API Success & Deployment Handling', () => {
    it('10. Add key executes PUT and offers optional deploy', async () => {
      const requestedCalls: { url: string; method: string; body?: any }[] = [];

      const mockFetch = jest.fn().mockImplementation((url: string, opts: any) => {
        const method = opts?.method || 'GET';
        requestedCalls.push({ url, method, body: opts?.body });

        if (url.endsWith('/env-vars?limit=100')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ envVar: { key: 'GEMINI_API_KEY_1', value: 'val' } }],
          });
        }
        if (url.includes('/env-vars/GEMINI_API_KEY_3')) {
          return Promise.resolve({ ok: true, json: async () => ({ key: 'GEMINI_API_KEY_3', value: 'new' }) });
        }
        if (url.endsWith('/deploys')) {
          return Promise.resolve({ ok: true, json: async () => ({ id: 'dep-mock-123', status: 'created' }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }) });
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, logs } = createMockIo({
        promptHidden: jest.fn().mockResolvedValue('mock_valid_gemini_api_key_new_slot3_value'),
        confirm: jest.fn()
          .mockResolvedValueOnce(true) // Confirm adding key
          .mockResolvedValueOnce(true), // Confirm triggering deploy
      });

      const exitCode = await runKeyManager({ add: 3 }, client, io);
      expect(exitCode).toBe(0);

      // Verify PUT was sent for GEMINI_API_KEY_3
      const putCall = requestedCalls.find((c) => c.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(putCall?.url).toContain('/env-vars/GEMINI_API_KEY_3');

      // Verify POST was sent for /deploys
      const deployCall = requestedCalls.find((c) => c.method === 'POST' && c.url.endsWith('/deploys'));
      expect(deployCall).toBeDefined();

      const output = logs.join('\n');
      expect(output).toContain('GEMINI_API_KEY_3 added successfully to Render service');
      expect(output).toContain('Deployment successfully triggered on Render (Deploy ID: dep-mock-123)');
    });
  });

  describe('Environment Group Limitation & Error Sanitization', () => {
    it('11. Detects and reports clear error if variable is managed by a Render Environment Group', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string, opts: any) => {
        if (opts?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            status: 400,
            text: async () => 'Cannot update variable inherited from environment group "production-group"',
          });
        }
        if (url.endsWith('/env-vars?limit=100')) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }) });
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, errors } = createMockIo({
        promptHidden: jest.fn().mockResolvedValue('mock_valid_gemini_api_key_new_slot3_value'),
        confirm: jest.fn().mockResolvedValue(true),
      });

      const exitCode = await runKeyManager({ add: 3 }, client, io);
      expect(exitCode).toBe(1);

      const allErrors = errors.join('\n');
      expect(allErrors).toContain('Render Environment Group');
      expect(allErrors).toContain('cannot be modified via the Service Env-Var API');
    });

    it('12. Sanitizes Render API error messages so tokens are never leaked', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string, opts: any) => {
        if (opts?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            status: 401,
            // Simulating a raw server error that echoes authorization token
            text: async () => `Unauthorized: Bearer ${dummyApiKey} is invalid`,
          });
        }
        if (url.endsWith('/env-vars?limit=100')) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => ({ id: dummyServiceId, name: 'Arham-Backend' }) });
      });

      const client = new RenderApiClient(dummyApiKey, dummyServiceId, mockFetch as any);
      const { io, errors } = createMockIo({
        promptHidden: jest.fn().mockResolvedValue('mock_valid_gemini_api_key_new_slot3_value'),
        confirm: jest.fn().mockResolvedValue(true),
      });

      const exitCode = await runKeyManager({ add: 3 }, client, io);
      expect(exitCode).toBe(1);

      const allErrors = errors.join('\n');
      expect(allErrors).not.toContain(dummyApiKey);
      expect(allErrors).toContain('[RENDER_API_KEY_REDACTED]');
    });
  });
});
