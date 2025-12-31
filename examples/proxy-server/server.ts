import express, { Request, Response } from 'express';
import cors from 'cors';
import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LineraConfig {
  faucetUrl: string;
  skipProcessInbox?: boolean;
}

class LineraProxyServer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isReady = false;

  /**
   * Initialize the headless browser and load Linera client
   */
  async initialize(config: LineraConfig) {
    console.log('🚀 Starting Linera Proxy Server...');
    console.log('📦 Launching headless browser...');

    // Launch Puppeteer
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.page = await this.browser.newPage();

    // Enable console logging from the page
    this.page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        console.error(`[Browser Error] ${text}`);
      } else {
        console.log(`[Browser ${type}] ${text}`);
      }
    });

    // Handle page errors
    this.page.on('pageerror', (error) => {
      console.error('❌ Page error:', error.message);
    });

    // Load the HTML file with Linera client from HTTP server
    const clientUrl = `http://localhost:${STATIC_PORT}/client.html`;
    console.log('📄 Loading client page:', clientUrl);
    await this.page.goto(clientUrl, { waitUntil: 'networkidle0' });

    // Wait for the page to be ready
    await this.page.waitForFunction(() => {
      return window.LineraProxy !== undefined;
    });

    console.log('✅ Client page loaded, initializing Linera...');

    // Initialize the Linera client in the browser
    const result = await this.page.evaluate(async (cfg) => {
      return await window.LineraProxy.initializeLinera(cfg);
    }, config);

    if (!result.success) {
      throw new Error(`Failed to initialize Linera: ${result.error}`);
    }

    this.isReady = true;
    console.log('✅ Linera client initialized successfully!');
    console.log('📊 State:', JSON.stringify(result.state, null, 2));
  }

  /**
   * Check if the server is ready
   */
  checkReady() {
    if (!this.isReady || !this.page) {
      throw new Error('Server not ready. Please initialize first.');
    }
  }

  /**
   * Execute a GraphQL query
   */
  async query(appId: string, query: string, options = {}) {
    this.checkReady();
    return await this.page!.evaluate(
      async (appId, query, options) => {
        return await window.LineraProxy.executeQuery(appId, query, options);
      },
      appId,
      query,
      options
    );
  }

  /**
   * Execute a system mutation
   */
  async systemMutate(appId: string, mutation: string, options = {}) {
    this.checkReady();
    return await this.page!.evaluate(
      async (appId, mutation, options) => {
        return await window.LineraProxy.executeSystemMutation(appId, mutation, options);
      },
      appId,
      mutation,
      options
    );
  }

  /**
   * Get client state
   */
  async getState() {
    this.checkReady();
    return await this.page!.evaluate(() => {
      return window.LineraProxy.getClientState();
    });
  }

  /**
   * Get chain information
   */
  async getChain(chainId: string) {
    this.checkReady();
    return await this.page!.evaluate(
      async (chainId) => {
        const chain = await window.LineraProxy.getChain(chainId);
        // Convert chain object to serializable format
        return {
          chainId: chainId,
          // Add other chain properties as needed
        };
      },
      chainId
    );
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isReady = false;
    }
  }
}

// Create Express app
const app = express();
const lineraProxy = new LineraProxyServer();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    ready: lineraProxy['isReady'],
    timestamp: new Date().toISOString(),
  });
});

// Get client state
app.get('/api/state', async (req: Request, res: Response) => {
  try {
    const state = await lineraProxy.getState();
    res.json({ success: true, state });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute GraphQL query
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { appId, query, options } = req.body;

    if (!appId || !query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appId, query',
      });
    }

    const result = await lineraProxy.query(appId, query, options || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Query error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute system mutation
app.post('/api/mutate', async (req: Request, res: Response) => {
  try {
    const { appId, mutation, options } = req.body;

    if (!appId || !mutation) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appId, mutation',
      });
    }

    const result = await lineraProxy.systemMutate(appId, mutation, options || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Mutation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chain information
app.get('/api/chain/:chainId', async (req: Request, res: Response) => {
  try {
    const { chainId } = req.params;
    const chain = await lineraProxy.getChain(chainId);
    res.json({ success: true, data: chain });
  } catch (error: any) {
    console.error('Get chain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
const STATIC_PORT = 9876; // Internal port for serving static files to Puppeteer
const FAUCET_URL = process.env.FAUCET_URL || 'https://faucet.testnet-conway.linera.net';

// Start static file server for Puppeteer
function startStaticServer() {
  const staticApp = express();

  // Log requests for debugging (BEFORE static middleware)
  staticApp.use((req, res, next) => {
    console.log(`[Static] ${req.method} ${req.url}`);
    next();
  });

  // Set correct MIME type for .mjs files
  staticApp.use((req, res, next) => {
    if (req.path.endsWith('.mjs')) {
      res.type('application/javascript');
    }
    next();
  });

  staticApp.use(express.static(__dirname));

  const server = staticApp.listen(STATIC_PORT, () => {
    console.log(`📁 Static file server running on http://localhost:${STATIC_PORT}`);
    console.log(`📁 Serving from: ${__dirname}`);
  });

  return server;
}

async function main() {
  // Start static server first
  staticServerInstance = startStaticServer();

  try {
    // Initialize Linera proxy
    await lineraProxy.initialize({
      faucetUrl: FAUCET_URL,
      skipProcessInbox: true,
    });

    // Start HTTP server
    app.listen(PORT, () => {
      console.log('');
      console.log('═'.repeat(60));
      console.log('🎉 Linera Proxy Server is running!');
      console.log('═'.repeat(60));
      console.log(`📡 API Server: http://localhost:${PORT}`);
      console.log(`🔗 Faucet: ${FAUCET_URL}`);
      console.log('');
      console.log('Available endpoints:');
      console.log(`  GET  /health              - Health check`);
      console.log(`  GET  /api/state           - Get client state`);
      console.log(`  POST /api/query           - Execute GraphQL query`);
      console.log(`  POST /api/mutate          - Execute system mutation`);
      console.log(`  GET  /api/chain/:chainId  - Get chain info`);
      console.log('═'.repeat(60));
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

let staticServerInstance: any = null;

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await lineraProxy.destroy();
  if (staticServerInstance) {
    staticServerInstance.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await lineraProxy.destroy();
  if (staticServerInstance) {
    staticServerInstance.close();
  }
  process.exit(0);
});

// Start the server
main();
