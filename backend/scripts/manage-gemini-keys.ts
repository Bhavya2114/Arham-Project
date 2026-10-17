import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

export interface RenderEnvVar {
  key: string;
  value: string;
}

export interface RenderServiceInfo {
  id: string;
  name: string;
  type?: string;
  updatedAt?: string;
}

export interface CliOptions {
  list?: boolean;
  add?: number;
  replace?: number;
  remove?: number;
  deploy?: boolean;
  dryRun?: boolean;
}

export interface IoInterface {
  promptText: (question: string) => Promise<string>;
  promptHidden: (question: string) => Promise<string>;
  confirm: (question: string) => Promise<boolean>;
  log: (msg: string) => void;
  error: (msg: string) => void;
}

export class RenderApiClient {
  private baseUrl = 'https://api.render.com/v1';

  constructor(
    private apiKey: string,
    private serviceId: string,
    private fetchFn: typeof fetch = fetch
  ) {}

  private get headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private sanitizeErrorMessage(errText: string): string {
    // Strip any potential token or secret leakage from raw error response
    let sanitized = errText;
    if (this.apiKey) {
      sanitized = sanitized.split(this.apiKey).join('[RENDER_API_KEY_REDACTED]');
    }
    return sanitized;
  }

  public async getService(): Promise<RenderServiceInfo> {
    const res = await this.fetchFn(`${this.baseUrl}/services/${this.serviceId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to fetch Render service (${res.status}): ${this.sanitizeErrorMessage(body)}`);
    }

    const data = (await res.json()) as any;
    return {
      id: data.id || this.serviceId,
      name: data.name || 'Unknown Service',
      type: data.type,
      updatedAt: data.updatedAt,
    };
  }

  public async listEnvVars(): Promise<RenderEnvVar[]> {
    const res = await this.fetchFn(`${this.baseUrl}/services/${this.serviceId}/env-vars?limit=100`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to list Render env vars (${res.status}): ${this.sanitizeErrorMessage(body)}`);
    }

    const data = (await res.json()) as any;
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => {
      if (item.envVar) {
        return { key: item.envVar.key, value: item.envVar.value };
      }
      return { key: item.key, value: item.value };
    });
  }

  public async setEnvVar(keyName: string, value: string): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/services/${this.serviceId}/env-vars/${keyName}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ value }),
    });

    if (!res.ok) {
      const body = await res.text();
      const sanitized = this.sanitizeErrorMessage(body);
      if (sanitized.toLowerCase().includes('environment group') || sanitized.toLowerCase().includes('inherited')) {
        throw new Error(
          `Variable ${keyName} is managed by a linked Render Environment Group and cannot be modified via the Service Env-Var API. Please manage it directly under Render Environment Groups.`
        );
      }
      throw new Error(`Failed to set Render env var (${res.status}): ${sanitized}`);
    }
  }

  public async deleteEnvVar(keyName: string): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/services/${this.serviceId}/env-vars/${keyName}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!res.ok) {
      const body = await res.text();
      const sanitized = this.sanitizeErrorMessage(body);
      if (sanitized.toLowerCase().includes('environment group') || sanitized.toLowerCase().includes('inherited')) {
        throw new Error(
          `Variable ${keyName} is managed by a linked Render Environment Group and cannot be deleted via the Service Env-Var API. Please manage it directly under Render Environment Groups.`
        );
      }
      throw new Error(`Failed to delete Render env var (${res.status}): ${sanitized}`);
    }
  }

  public async triggerDeploy(): Promise<{ id: string; status?: string }> {
    const res = await this.fetchFn(`${this.baseUrl}/services/${this.serviceId}/deploys`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ clearCache: 'do_not_clear' }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to trigger Render deploy (${res.status}): ${this.sanitizeErrorMessage(body)}`);
    }

    const data = (await res.json()) as any;
    return {
      id: data.id || 'deploy_triggered',
      status: data.status || 'created',
    };
  }
}

export function validateSlot(slotInput: string | number): { valid: boolean; slotNumber?: number; error?: string } {
  const parsed = typeof slotInput === 'number' ? slotInput : parseInt(String(slotInput).trim(), 10);
  if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    return { valid: false, error: 'Key slot must be a positive integer (e.g. 1, 2, 3, 4).' };
  }
  return { valid: true, slotNumber: parsed };
}

export function formatKeyName(slot: number): string {
  return `GEMINI_API_KEY_${slot}`;
}

export function validateKeyName(keyName: string): boolean {
  return /^GEMINI_API_KEY_(\d+)$/.test(keyName) || keyName === 'GEMINI_API_KEY';
}

export function validateKeyValue(keyValue: string): { valid: boolean; error?: string } {
  const trimmed = (keyValue || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'API key cannot be empty or whitespace.' };
  }
  if (trimmed.length < 10) {
    return { valid: false, error: 'Invalid Gemini API key format (value appears too short).' };
  }
  return { valid: true };
}

export const defaultIo: IoInterface = {
  promptText: (question: string): Promise<string> => {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  },

  promptHidden: (question: string): Promise<string> => {
    return new Promise((resolve) => {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      let input = '';

      const onData = (chunk: Buffer) => {
        const char = chunk.toString();
        for (const c of char) {
          if (c === '\n' || c === '\r' || c === '\u0004') {
            stdin.removeListener('data', onData);
            if (stdin.isTTY) {
              stdin.setRawMode(wasRaw || false);
            }
            process.stdout.write('\n');
            resolve(input.trim());
            return;
          } else if (c === '\u0003') {
            stdin.removeListener('data', onData);
            if (stdin.isTTY) {
              stdin.setRawMode(wasRaw || false);
            }
            process.exit(130);
          } else if (c === '\b' || c === '\x7f') {
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else {
            input += c;
            process.stdout.write('*');
          }
        }
      };

      if (stdin.isTTY) {
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);
      } else {
        // Fallback for non-interactive / piped environments
        let buffer = '';
        const onNonTty = (data: Buffer) => {
          buffer += data.toString();
          if (buffer.includes('\n')) {
            stdin.removeListener('data', onNonTty);
            resolve(buffer.split('\n')[0].trim());
          }
        };
        stdin.on('data', onNonTty);
      }
    });
  },

  confirm: async (question: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(`${question} (y/N): `, (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase() === 'y' || ans.trim().toLowerCase() === 'yes');
      });
    });
  },

  log: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(msg),
};

export async function runKeyManager(
  options: CliOptions,
  client: RenderApiClient,
  io: IoInterface = defaultIo
): Promise<number> {
  const isDryRun = !!options.dryRun;

  try {
    io.log('================================================================');
    io.log('  Render Backend Gemini Key Automation Tool');
    io.log('================================================================');
    if (isDryRun) {
      io.log('[DRY-RUN MODE ACTIVATED] No modifying requests will be made.');
    }

    // Verify service connectivity and identity
    const serviceInfo = await client.getService();
    io.log(`Connected to Render service: "${serviceInfo.name}" (${serviceInfo.id})`);
    io.log('----------------------------------------------------------------');

    // 1. List operation
    if (options.list) {
      await handleList(client, io);
      return 0;
    }

    // 2. Add operation
    if (options.add !== undefined) {
      await handleAdd(options.add, isDryRun, client, io);
      return 0;
    }

    // 3. Replace operation
    if (options.replace !== undefined) {
      await handleReplace(options.replace, isDryRun, client, io);
      return 0;
    }

    // 4. Remove operation
    if (options.remove !== undefined) {
      await handleRemove(options.remove, isDryRun, client, io);
      return 0;
    }

    // 5. Deploy operation
    if (options.deploy) {
      await handleDeploy(isDryRun, client, io);
      return 0;
    }

    // Interactive Menu Mode if no specific action provided
    await handleInteractiveMenu(isDryRun, client, io);
    return 0;
  } catch (err: any) {
    io.error(`\n[ERROR] ${err?.message || 'An unexpected error occurred.'}`);
    return 1;
  }
}

async function handleList(client: RenderApiClient, io: IoInterface): Promise<void> {
  io.log('Fetching configured Gemini environment variables from Render...\n');
  const allVars = await client.listEnvVars();
  const geminiVars = allVars.filter((v) => validateKeyName(v.key));

  if (geminiVars.length === 0) {
    io.log('No Gemini API key environment variables are currently configured on this Render service.');
    return;
  }

  // Sort numerically: GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
  geminiVars.sort((a, b) => {
    const numA = parseInt(a.key.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.key.replace(/\D/g, '') || '0', 10);
    return numA - numB;
  });

  io.log('Configured Gemini Keys on Render:');
  for (const item of geminiVars) {
    // STRICT RULE: Never display key values, partial strings, or lengths. Only variable name and safe status.
    io.log(`  ${item.key.padEnd(24)} [CONFIGURED]`);
  }
  io.log(`\nTotal: ${geminiVars.length} key(s) configured.`);
}

async function handleAdd(slot: number, isDryRun: boolean, client: RenderApiClient, io: IoInterface): Promise<void> {
  const slotVal = validateSlot(slot);
  if (!slotVal.valid || slotVal.slotNumber === undefined) {
    io.error(`[ERROR] ${slotVal.error}`);
    return;
  }

  const keyName = formatKeyName(slotVal.slotNumber);
  const existingVars = await client.listEnvVars();
  const exists = existingVars.some((v) => v.key === keyName);

  if (exists) {
    io.error(`[ERROR] ${keyName} already exists on Render. To update it, use the Replace operation.`);
    return;
  }

  const newKey = await io.promptHidden(`Enter Gemini API key for ${keyName} (input hidden): `);
  const valCheck = validateKeyValue(newKey);
  if (!valCheck.valid) {
    io.error(`[ERROR] ${valCheck.error}`);
    return;
  }

  const confirmed = await io.confirm(`Confirm adding ${keyName} to Render?`);
  if (!confirmed) {
    io.log('Operation cancelled by user.');
    return;
  }

  if (isDryRun) {
    io.log(`[DRY-RUN] Would send PUT /v1/services/{serviceId}/env-vars/${keyName} with new key value.`);
    io.log(`[DRY-RUN] No changes were made to Render.`);
    return;
  }

  await client.setEnvVar(keyName, newKey);
  io.log(`\n✓ ${keyName} added successfully to Render service.`);
  io.log('Notice: Render environment variable updates do not deploy running services automatically.');

  await promptDeploymentAfterChange(client, io);
}

async function handleReplace(slot: number, isDryRun: boolean, client: RenderApiClient, io: IoInterface): Promise<void> {
  const slotVal = validateSlot(slot);
  if (!slotVal.valid || slotVal.slotNumber === undefined) {
    io.error(`[ERROR] ${slotVal.error}`);
    return;
  }

  const keyName = formatKeyName(slotVal.slotNumber);
  const existingVars = await client.listEnvVars();
  const exists = existingVars.some((v) => v.key === keyName);

  if (!exists) {
    io.log(`Notice: ${keyName} does not currently exist on Render. It will be created as a new key.`);
  }

  const confirmed = await io.confirm(`Are you sure you want to replace ${keyName} on Render?`);
  if (!confirmed) {
    io.log('Operation cancelled by user.');
    return;
  }

  const newKey = await io.promptHidden(`Enter new Gemini API key for ${keyName} (input hidden): `);
  const valCheck = validateKeyValue(newKey);
  if (!valCheck.valid) {
    io.error(`[ERROR] ${valCheck.error}`);
    return;
  }

  if (isDryRun) {
    io.log(`[DRY-RUN] Would send PUT /v1/services/{serviceId}/env-vars/${keyName} with new key value.`);
    io.log(`[DRY-RUN] No changes were made to Render.`);
    return;
  }

  await client.setEnvVar(keyName, newKey);
  io.log(`\n✓ ${keyName} replaced successfully on Render service.`);
  io.log('Notice: Render environment variable updates do not deploy running services automatically.');

  await promptDeploymentAfterChange(client, io);
}

async function handleRemove(slot: number, isDryRun: boolean, client: RenderApiClient, io: IoInterface): Promise<void> {
  const slotVal = validateSlot(slot);
  if (!slotVal.valid || slotVal.slotNumber === undefined) {
    io.error(`[ERROR] ${slotVal.error}`);
    return;
  }

  const keyName = formatKeyName(slotVal.slotNumber);
  const existingVars = await client.listEnvVars();
  const exists = existingVars.some((v) => v.key === keyName);

  if (!exists) {
    io.error(`[ERROR] ${keyName} does not exist on Render.`);
    return;
  }

  const confirmed = await io.confirm(`Are you sure you want to delete ${keyName} from Render? This cannot be undone.`);
  if (!confirmed) {
    io.log('Operation cancelled by user.');
    return;
  }

  if (isDryRun) {
    io.log(`[DRY-RUN] Would send DELETE /v1/services/{serviceId}/env-vars/${keyName}.`);
    io.log(`[DRY-RUN] No changes were made to Render.`);
    return;
  }

  await client.deleteEnvVar(keyName);
  io.log(`\n✓ ${keyName} deleted successfully from Render service.`);
  io.log('Notice: Render environment variable updates do not deploy running services automatically.');

  await promptDeploymentAfterChange(client, io);
}

async function handleDeploy(isDryRun: boolean, client: RenderApiClient, io: IoInterface): Promise<void> {
  const confirmed = await io.confirm('Trigger a new Render deployment/restart now?');
  if (!confirmed) {
    io.log('Deployment cancelled.');
    return;
  }

  if (isDryRun) {
    io.log('[DRY-RUN] Would trigger POST /v1/services/{serviceId}/deploys on Render.');
    io.log('[DRY-RUN] No deployment was triggered.');
    return;
  }

  io.log('Triggering Render deployment...');
  const deploy = await client.triggerDeploy();
  io.log(`✓ Deployment successfully triggered on Render (Deploy ID: ${deploy.id}).`);
  io.log('The backend will load the updated environment variables once the deployment finishes building.');
}

async function promptDeploymentAfterChange(client: RenderApiClient, io: IoInterface): Promise<void> {
  const shouldDeploy = await io.confirm('Do you want to trigger a Render deployment/restart now to apply changes?');
  if (!shouldDeploy) {
    io.log('Skipping deployment. Remember to redeploy or restart the service on Render when ready.');
    return;
  }

  io.log('Triggering Render deployment...');
  const deploy = await client.triggerDeploy();
  io.log(`✓ Deployment successfully triggered on Render (Deploy ID: ${deploy.id}).`);
}

async function handleInteractiveMenu(isDryRun: boolean, client: RenderApiClient, io: IoInterface): Promise<void> {
  io.log('\nChoose an operation:');
  io.log('  1. List configured Gemini keys');
  io.log('  2. Add new Gemini key');
  io.log('  3. Replace existing Gemini key');
  io.log('  4. Remove a Gemini key');
  io.log('  5. Trigger Render deployment / restart');
  io.log('  6. Exit');

  const choice = await io.promptText('\nEnter choice (1-6): ');

  switch (choice) {
    case '1':
      await handleList(client, io);
      break;
    case '2': {
      const slotStr = await io.promptText('Enter key slot number to add (e.g. 3 for GEMINI_API_KEY_3): ');
      const slotVal = validateSlot(slotStr);
      if (!slotVal.valid || slotVal.slotNumber === undefined) {
        io.error(`[ERROR] ${slotVal.error}`);
        return;
      }
      await handleAdd(slotVal.slotNumber, isDryRun, client, io);
      break;
    }
    case '3': {
      const slotStr = await io.promptText('Enter key slot number to replace (e.g. 1 for GEMINI_API_KEY_1): ');
      const slotVal = validateSlot(slotStr);
      if (!slotVal.valid || slotVal.slotNumber === undefined) {
        io.error(`[ERROR] ${slotVal.error}`);
        return;
      }
      await handleReplace(slotVal.slotNumber, isDryRun, client, io);
      break;
    }
    case '4': {
      const slotStr = await io.promptText('Enter key slot number to remove (e.g. 3 for GEMINI_API_KEY_3): ');
      const slotVal = validateSlot(slotStr);
      if (!slotVal.valid || slotVal.slotNumber === undefined) {
        io.error(`[ERROR] ${slotVal.error}`);
        return;
      }
      await handleRemove(slotVal.slotNumber, isDryRun, client, io);
      break;
    }
    case '5':
      await handleDeploy(isDryRun, client, io);
      break;
    case '6':
      io.log('Exiting.');
      break;
    default:
      io.error('[ERROR] Invalid option selected.');
      break;
  }
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--deploy') {
      options.deploy = true;
    } else if (arg === '--add') {
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options.add = parseInt(nextArg, 10);
        i++;
      } else {
        options.add = 0; // will trigger prompt
      }
    } else if (arg === '--replace') {
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options.replace = parseInt(nextArg, 10);
        i++;
      } else {
        options.replace = 0;
      }
    } else if (arg === '--remove') {
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options.remove = parseInt(nextArg, 10);
        i++;
      } else {
        options.remove = 0;
      }
    }
  }

  return options;
}

// Main execution when run directly
if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('manage-gemini-keys'))) {
  const apiKey = process.env.RENDER_API_KEY?.trim();
  const serviceId = process.env.RENDER_SERVICE_ID?.trim();

  if (!apiKey || !serviceId) {
    console.error('\n================================================================');
    console.error('  RENDER CONFIGURATION ERROR');
    console.error('================================================================');
    console.error('Missing required Render credentials in local environment:\n');
    if (!apiKey) console.error('  • RENDER_API_KEY is not set');
    if (!serviceId) console.error('  • RENDER_SERVICE_ID is not set');
    console.error('\nPlease configure these in backend/.env:');
    console.error('  RENDER_API_KEY="your_render_api_token"');
    console.error('  RENDER_SERVICE_ID="your_render_backend_service_id"');
    console.error('\nHow to find these:');
    console.error('  1. RENDER_API_KEY: Render Dashboard -> Account Settings -> API Keys');
    console.error('  2. RENDER_SERVICE_ID: Found in your service URL (srv-xxxxxxxxxxxxxxxxxxxx)');
    console.error('================================================================\n');
    process.exit(1);
  }

  const client = new RenderApiClient(apiKey, serviceId);
  const options = parseCliArgs(process.argv.slice(2));

  runKeyManager(options, client, defaultIo)
    .then((exitCode) => {
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    })
    .catch((err) => {
      console.error('[FATAL ERROR]', err?.message || err);
      process.exit(1);
    });
}
