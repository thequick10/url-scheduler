import { config as dotenv } from "dotenv";
dotenv();

import express from "express";
import { resolveWithBrowserAPI, getBrowserWss, getRegionZoneMap } from './src/resolver.js';
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet, { referrerPolicy } from "helmet";
import rateLimit from "express-rate-limit";
import os from 'os';
import https from 'https';
import session from 'express-session';
import fs from 'fs/promises';
import MySQLStoreFactory from 'express-mysql-session';
import bcrypt from 'bcrypt';
import { getDbPool, ensureSchema, handlePoolError } from './src/db.js';
import { createUser, findUserByUsernameOrEmail, getUserById, listUsers, updateUser, deleteUserById, countUsers, approveUser } from './src/models/userModel.js';
import { logActivity, listActivitiesForUserOrAll } from './src/models/activityModel.js';
import { createScheduledJob, listScheduledJobs, getScheduledResults, updateScheduledResult, deleteAllScheduledResults, deleteScheduledJob, getPendingJobs, updateJobStatus, createScheduledResult } from './src/scheduler/scheduleModel.js';
import { updateResolutionStats, getResolutionStats, resetResolutionStats } from './src/models/resolutionStatsModel.js';
import multer from 'multer';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import puppeteer from 'puppeteer-core';

dotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 8080;

// Serve static frontend (MUST BE FIRST!)
app.use(express.static(path.join(__dirname, "public")));

// Trust first proxy (required before session when using secure cookies behind a proxy)
app.set('trust proxy', 1);

//Reset Resolution Stat data in every 24hours
async function resetStats() {
  try {
    await resetResolutionStats();
    console.log("📊 Resolution stats have been reset");
  } catch (error) {
    console.error("Error resetting resolution stats:", error);
  }
}
// Time of day to reset (24-hour format)
const RESET_HOUR = 0;  // 5:30 AM - IST
const RESET_MINUTE = 0;
const RESET_SECOND = 0;

// Calculate the delay until the next reset time
function getDelayUntilNextReset() {
  const now = new Date();
  const nextReset = new Date();
  nextReset.setHours(RESET_HOUR, RESET_MINUTE, RESET_SECOND, 0);
  if (nextReset <= now) {
    // If the time today has already passed, schedule for tomorrow
    nextReset.setDate(nextReset.getDate() + 1);
  }
  return nextReset - now;
}

setTimeout(() => {
  // Run once at the specified time
  resetStats();

  // Then schedule it to run every 24 hours
  setInterval(resetStats, 24 * 60 * 60 * 1000);

}, getDelayUntilNextReset());

// Initialize DB schema and session store
await ensureSchema();

// Keep the database connection alive
setInterval(async () => {
  try {
    const pool = getDbPool();
    await pool.query('SELECT 1');
    // console.log('[DB] Keep-alive ping sent.');
  } catch (e) {
    console.error('[DB] Keep-alive ping failed:', e);
  }
}, 10 * 60 * 1000); // every 10 minutes

const pool = getDbPool(); // Get the pool
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000
}, pool); // Pass the pool

// Session middleware
const isProduction = process.env.NODE_ENV === 'production';

// Calculate maxAge for 8 hours in IST
const now = new Date();
const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
const nowIST = new Date(now.getTime() + istOffset);
const expirationIST = new Date(nowIST.getTime() + 8 * 60 * 60 * 1000);
const maxAgeIST = expirationIST.getTime() - now.getTime();

// Session middleware
app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    maxAge: maxAgeIST,
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto', 
  }
}));

// Helpers: auth guards
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.accepts('html')) return res.redirect('/login');
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return req.accepts('html') ? res.redirect('/login') : res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Public paths (no auth needed)
const publicPaths = new Set([
  '/login',
  '/signup',
  '/auth/error.html',
  '/auth/login.html',
  '/auth/register.html',
  '/api/auth/me',
  '/api/auth/register',
  '/favicon.ico',
  '/system-info',
  '/ping',
  '/puppeteer-status'
]);

// Allow bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Route protection before static: allow static assets via extension
const pageAccess = {
    'Coordinator': ['/scheduler/schedule.html', '/scheduler/scheduled-results.html', '/my-account/my-account.html'],
    'Subscriber': ['/index.html', '/my-account/my-account.html'],
    'Analytics': ['/analytics/stats.html', '/my-account/my-account.html']
};

app.use((req, res, next) => {
  if (publicPaths.has(req.path)) return next();
  if (req.path.startsWith('/components/')) return next();
  if (/".*.(css|js|png|jpg|jpeg|gif|svg|ico|json|map)$/.test(req.path)) return next();
  if (!req.session?.user) {
    return req.accepts('html') ? res.redirect('/login') : res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET' && req.path.endsWith('.html')) {
    const userRole = req.session.user.role;

    if (userRole === 'Admin') {
        return next();
    }

    const allowedPages = pageAccess[userRole];

    if (allowedPages && allowedPages.includes(req.path)) {
      return next();
    } else {
      const defaultPage = allowedPages ? allowedPages[0] : '/login';
      return res.redirect(defaultPage);
    }
  }
  next();
});

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Auth pages
app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/index.html');
  res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get('/signup', (req, res) => {
  if (req.session?.user) return res.redirect('/index.html');
  res.sendFile(path.join(__dirname, 'public', 'auth', 'register.html'));
});

// Enhanced middleware stack
app.use(helmet({
  contentSecurityPolicy: true, // Enable and customize as needed
  referrerPolicy : {
    policy: "no-referrer",
  },
})); // Security headers

// Enable CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : null;

if (!allowedOrigins) {
  console.error('[CORS] ERROR: ALLOWED_ORIGINS environment variable is not set.');
  process.exit(1); // Or handle it another way, like disabling CORS
}
console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  }, 
  credentials: true,
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Rate limiting
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.RATE_LIMIT || 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
if (process.env.ENABLE_RATE_LIMIT !== 'false') {
  console.log('[Rate Limiting] ENABLED');
  app.use('/resolve', limiter);
} else {
  console.log('[Rate Limiting] DISABLED');
}

// BRIGHTDATA_API_USAGE_CONFIG
const API_KEY = process.env.BRIGHTDATA_API_KEY;
const ZONE = process.env.BRIGHTDATA_ZONE;

// Timing stats
const TIMING_STATS_FILE = path.join(__dirname, 'public', 'time-stats', 'time-stats.json');

async function appendTimingStat(stat) {
  let stats = [];
  try {
    const data = await fs.readFile(TIMING_STATS_FILE, 'utf-8');
    stats = JSON.parse(data);
  } catch (e) {
    // File may not exist yet
    stats = [];
  }
  stats.push(stat);
  // Keep only last 31 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 31);
  stats = stats.filter(s => new Date(s.date) >= cutoff);
  await fs.writeFile(TIMING_STATS_FILE, JSON.stringify(stats, null, 2));
}

app.get('/time-stats', async (req, res) => {
  try {
    let stats = [];
    try {
      const data = await fs.readFile(TIMING_STATS_FILE, 'utf-8');
      stats = JSON.parse(data);
    } catch (e) {
      stats = [];
    }
    // Optional: filter by date range
    const { start, end } = req.query;
    if (start || end) {
      stats = stats.filter(row => {
        return (!start || row.date >= start) && (!end || row.date <= end);
      });
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load timing stats', details: err.message });
  }
});

// API route: /resolve?url=https://domain.com&region=ua - /resolve?url=https://domain.com&region=ua&uaType=desktop|mobile
app.get("/resolve", requireAuth, async (req, res) => {
  const { url: inputUrl, region = "US", uaType } = req.query;

  if (!inputUrl) {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    new URL(inputUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  //console.log(`⌛ Requested new URL: ${inputUrl}`);
  // console.log(`🌐 Resolving URL for region [${region}]:`, inputUrl);
  //console.log(`🌐 Resolving URL for region [${region}] with uaType [${uaType}]:`, inputUrl);

  try {
    const startTime = Date.now();
    const result = await resolveWithBrowserAPI(inputUrl, region, uaType);
    const endTime = Date.now();
    const timeTaken = endTime - startTime;

    // Check if there was an error in the browser API
    if (result.error) {
      await updateResolutionStats({ region, isSuccess: false });
      
      return res.status(500).json({ 
        error: "❌ Resolution failed", 
        details: result.error,
        originalUrl: inputUrl,
        region,
        uaType
      });
    }

    const { finalUrl, ipData } = result;

    if (finalUrl && finalUrl.trim() !== "") {
      await updateResolutionStats({ region, isSuccess: true });
    } else {
      await updateResolutionStats({ region, isSuccess: false });
      
      // Return error response when finalUrl is not available
      return res.status(500).json({ 
        error: "❌ Resolution failed", 
        details: "Final URL could not be resolved",
        originalUrl: inputUrl,
        region,
        uaType
      });
    }

    // Save timing stat (date, url, time) in IST with YYYY-MM-DD format
    // const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const today = new Date().toISOString().slice(0, 10);
    // await appendTimingStat({ date: today, url: inputUrl, time: timeTaken });
    try {
      await appendTimingStat({ date: today, url: inputUrl, time: timeTaken });
    } catch (e) {
      console.warn('[Timing Stat] Failed to append timing stat:', e.message);
    }
    
    if(finalUrl){
      console.log(`→ Final URL   : ${finalUrl}`);
    } else {
      console.log(`⚠️ Final URL could not be resolved.`);
    }

    if (ipData?.ip) {
        console.log(`🌍 IP Info : ${ipData.ip} (${ipData.country || "Unknown Country"} - ${ipData.region || "Unknown Region"} - ${ipData.country_code || "Unknown country_code"})`);
        console.log(`🔍 Region Match: ${ipData.country_code?.toUpperCase() === region.toUpperCase() ? '✅ REGION MATCHED' : '❌ REGION MISMATCH'}`);
    }

    const hasClickId = finalUrl ? finalUrl.includes("clickid=") || finalUrl.includes("clickId=") : false;

    const responsePayload = {
      originalUrl: inputUrl,
      finalUrl,
      region,
      requestedRegion: region,
      actualRegion: ipData?.country_code?.toUpperCase() || 'Unknown',
      regionMatch: ipData?.country_code?.toUpperCase() === region.toUpperCase(),
      method: "browser-api",
      hasClickId,
      hasClickRef: finalUrl?.includes("clickref="),
      hasUtmSource: finalUrl?.includes("utm_source="),
      hasImRef: finalUrl?.includes("im_ref="),
      hasMtkSource: finalUrl?.includes("mkt_source="),
      hasTduId: finalUrl?.includes("tduid="),
      hasPublisherId: finalUrl?.includes("publisherId="),
      ipData, // Region detection info
      uaType
    };

    const single_url_loaded = `URL Loaded ${inputUrl}`;
    try { await logActivity(req.session.user.id, 'RESOLVE_URL', `${single_url_loaded}`); } catch {}
    
    return res.json(responsePayload);
  } catch (err) {
    try { await logActivity(req.session.user.id, 'FAILED', `URL Resolution Failed ${inputUrl}`); } catch {}
    await updateResolutionStats({ region, isSuccess: false });

    console.error(`❌ Resolution failed:`, err.stack || err.message);
    return res.status(500).json({ error: "❌ Resolution failed", details: err.stack || err.message });
  }
});

//Allow users to request resolution across multiple regions at once, getting all the resolved URLs at the same time.
// Endpoint to access this - /resolve-multiple?url=https://domain.com&regions=us,ca,ae - https://domain.com&regions=us,ca,ae&uaType=desktop|mobile
app.get('/resolve-multiple', requireAuth, async (req, res) => {
  const { url: inputUrl, regions, uaType } = req.query;

  if (!inputUrl || !regions) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const regionList = regions.split(',');
  const promises = regionList.map(region => resolveWithBrowserAPI(inputUrl, region, uaType));
  const results = await Promise.all(promises);

  results.forEach(async (result, i) => {
    const region = regionList[i];

    if (result.finalUrl) {
      await updateResolutionStats({ region, isSuccess: true });
    } else {
      await updateResolutionStats({ region, isSuccess: false });
    }
  });

  try { await logActivity(req.session.user.id, 'RESOLVE_MULTIPLE', { inputUrl, regions: regionList }); } catch {}
  res.json({
    originalUrl: inputUrl,
    results: results.map((result, index) => ({
      region: regionList[index],
      finalUrl: result.finalUrl,
      ipData: result.ipData,
    })),
  });
});

// Enhanced BrightData API Usage Endpoint with Bandwidth Features /zone-usage - /zone-usage?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/zone-usage', (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      error: 'Please provide both "from" and "to" query parameters in YYYY-MM-DD format.',
    });
  }

  const options = {
    hostname: 'api.brightdata.com',
    path: `/zone/bw?zone=${ZONE}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
    rejectUnauthorized: false, // ignore SSL certificate issues
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';

    apiRes.on('data', (chunk) => {
      data += chunk;
    });

    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('Raw API response:', json);

        const result = {};
        
        // Access the zone data (keeping original structure)
        const zoneData = json.c_a4a3b5b0.data?.[ZONE];
        const { reqs_browser_api, bw_browser_api, bw_sum } = zoneData || {};

        console.log('Zone data:', zoneData);

        if (reqs_browser_api && bw_browser_api) {
          // Create a list of dates between 'from' and 'to'
          const dates = getDatesBetween(from, to);

          // Match dates to request and bandwidth data
          dates.forEach((date, index) => {
            result[date] = {
              requests: reqs_browser_api[index] || 0,
              bandwidth: bw_browser_api[index] || 0, // in bytes
              bandwidthPerRequest: reqs_browser_api[index] ? bw_browser_api[index] / reqs_browser_api[index] : 0
            };
          });
        }

        // Add summary statistics
        const summary = {
          totalBandwidth: bw_sum ? (bw_sum[0] || 0) : 0, // Total bandwidth in bytes
          totalRequests: reqs_browser_api ? reqs_browser_api.reduce((sum, val) => sum + val, 0) : 0,
          dateRange: {
            from: from,
            to: to
          }
        };
        const fetched_text = "Successfully Fetched";
        try { logActivity(req.session.user.id, 'BRIGHTDATA_SUMMARY_FETCHED', `${fetched_text}`); } catch {}
        res.json({ 
          data: result,
          summary: summary
        });
        
      } catch (e) {
        console.error('Error parsing response:', e);
        res.status(500).json({
          error: 'Failed to parse Bright Data API response.',
          details: e.message,
        });
      }
    });
  });

  apiReq.on('error', (e) => {
    console.error('Request error:', e.message);
    res.status(500).json({
      error: 'Request to Bright Data API failed.',
      details: e.message,
    });
  });

  apiReq.end();
});

// Helper function to get all dates between 'from' and 'to' (unchanged)
function getDatesBetween(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

// Regions check
app.get("/regions", (req, res) => {
  const map = getRegionZoneMap();
  res.json(Object.keys(map));
});

app.get("/system-info", (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  const loadAverage = os.loadavg();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  const healthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime)} seconds`,
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    },
    loadAverage: {
      "1m": loadAverage[0].toFixed(2),
      "5m": loadAverage[1].toFixed(2),
      "15m": loadAverage[2].toFixed(2),
    },
    memoryStats: {
      total: `${(totalMemory / 1024 / 1024).toFixed(2)} MB`,
      free: `${(freeMemory / 1024 / 1024).toFixed(2)} MB`,
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0].model,
    },
    healthy: freeMemory / totalMemory > 0.1 && loadAverage[0] < os.cpus().length,
  };

  res.status(200).json(healthCheck);
});

// Fallback for homepage
app.get("/", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Dashboard route
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Get the usage.html file from analytics folder and making an endpoint
app.get('/analytics', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics', 'stats.html'));
});

//serve it via a clean route
app.get("/resolution-stats", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'resolution-stats', 'resolutions.html'));
});

// Get time stats page from time-stats folder
app.get("/time-stats.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'time-stats', 'time-stats.html'));
});

// Get User Managerment page page from public folder
app.get("/manage-users", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user-management.html'));
});

// My Account page
app.get('/my-account', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-account', 'my-account.html'));
});

// Schedule page
app.get('/scheduler/schedule', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scheduler', 'schedule.html'));
});

// Scheduled results page
app.get('/scheduler/scheduled-results', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scheduler', 'scheduled-results.html'));
});

// Admin-only Signup Requests page
app.get('/signup-requests', requireRole('Admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup-requests.html'));
});

//serve it via a clean route endpoint like /api/resolution-stats
app.get("/api/resolution-stats", requireAuth, async (req, res) => {
  try {
    const stats = await getResolutionStats();
    const totalSuccess = stats.reduce((sum, s) => sum + s.success_count, 0);
    const totalFailure = stats.reduce((sum, s) => sum + s.failure_count, 0);
    const perRegion = stats.reduce((acc, s) => {
      acc[s.region] = { success: s.success_count, failure: s.failure_count };
      return acc;
    }, {});

    res.json({
      totalSuccess,
      totalFailure,
      perRegion,
      failedUrls: [] // This is not stored in DB yet
    });
  } catch (e) {
    console.error('Error fetching resolution stats:', e);
    res.status(500).json({ error: 'Failed to fetch resolution stats' });
  }
});

// Auth APIs
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const user = await findUserByUsernameOrEmail(username);
    if (!user) return res.redirect('/auth/error.html');
    if (!user.approved) {
      // Not approved yet
      return res.redirect('/auth/error.html');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.redirect('/auth/error.html');
    req.session.user = { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role };
    try { await logActivity(user.id, 'LOGIN', `${user.username}, LoggedIn Successfully`); } catch {}
    return req.session.save((err) => {
      if (err) return res.redirect('/auth/error.html');
      return res.redirect('/index.html');
    });
  } catch (e) {
    return res.redirect('/auth/error.html');
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, username, email, password } = req.body || {};
  try {
    const existing = await findUserByUsernameOrEmail(username);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const hash = await bcrypt.hash(password, 10);
    const id = await createUser({ name, username, email, passwordHash: hash, role: 'Subscriber' });
    try { await logActivity(id, 'REGISTER', { username }); } catch {}
    res.status(201).json({ id, approved: false, message: 'Registration submitted. Pending admin approval.' });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

// Logout route
app.get('/logout', requireAuth, async (req, res) => {
  try { await logActivity(req.session.user.id, 'LOGOUT', "User logged out"); } catch {}
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Admin: users CRUD
app.get('/api/users', requireRole('Admin'), async (req, res) => {
  try {
    const { q, page = 1, pageSize = 50 } = req.query;
    const users = await listUsers({ q, page: Number(page), pageSize: Number(pageSize) });
    const total = await countUsers({ q });
    res.json({ users, total });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Approve a pending user
app.post('/api/users/:id/approve', requireRole('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await updateUser(id, { approved: 1 });
    try { await logActivity(req.session.user.id, 'USER_APPROVE', { id }); } catch {}
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject (delete) a pending user
app.post('/api/users/:id/reject', requireRole('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await deleteUserById(id);
    try { await logActivity(req.session.user.id, 'USER_REJECT', { id }); } catch {}
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

app.post('/api/users', requireRole('Admin'), async (req, res) => {
  try {
    const { name, username, email, password, role = 'Subscriber', approved = true } = req.body || {};
    const hash = await bcrypt.hash(password, 10);
    const id = await createUser({ name, username, email, passwordHash: hash, role });
    // If admin wants to auto-approve, update flag
    if (approved) {
      await approveUser(id);
    }
    try { await logActivity(req.session.user.id, 'USER_CREATE', { id, username, role }); } catch {}
    res.status(201).json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireRole('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, username, email, role, password, approved } = req.body || {};
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    await updateUser(id, { name, username, email, role, passwordHash, approved });
    try { await logActivity(req.session.user.id, 'USER_UPDATE', { id, role }); } catch {}
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

//Update user details
app.put('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { name, username, email, password } = req.body || {};
    const userId = req.session.user.id;

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (password) {
      // Hash the password
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user profile
    await updateUser(userId, updateData);

    // Update session data
    if (name !== undefined) req.session.user.name = name;
    if (username !== undefined) req.session.user.username = username;
    if (email !== undefined) req.session.user.email = email;

    // Save session after updates
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try { await logActivity(userId, 'PROFILE_UPDATE', { fields: Object.keys(updateData) }); } catch {}

    res.json({ message: 'Profile updated successfully'});
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.delete('/api/users/:id', requireRole('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await deleteUserById(id);
    try { await logActivity(req.session.user.id, 'USER_DELETE', { id }); } catch {}
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Activities
app.get('/api/activities', requireAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 100, action, username, role, from, to } = req.query;
    const isAdmin = req.session.user.role === 'Admin';
    const { rows, total } = await listActivitiesForUserOrAll({
      userId: req.session.user.id,
      all: isAdmin,
      page: Number(page),
      pageSize: Number(pageSize),
      actionQuery: action,
      usernameQuery: username,
      roleQuery:role,
      fromDate: from,
      toDate: to
    });
    res.json({ activities: rows, total });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

app.post('/api/activities', requireAuth, async (req, res) => {
  try {
    const { action, details } = req.body || {};
    const id = await logActivity(req.session.user.id, action, details || {});
    res.status(201).json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Scheduling
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/schedule', requireAuth, upload.single('scheduleFile'), async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    const { originalname, mimetype, buffer } = req.file;
    const userId = req.session.user.id;

    if (!scheduledAt || !req.file) {
      return res.status(400).json({ error: 'Missing scheduledAt or file.' });
    }

    // Convert ISO 8601 to MySQL DATETIME format
    const formattedScheduledAt = new Date(scheduledAt).toISOString().slice(0, 19).replace('T', ' ');

    const jobId = await createScheduledJob({
      userId,
      fileName: originalname,
      mimeType: mimetype,
      fileContent: buffer,
      scheduledAt: formattedScheduledAt,
    });

    try {
      await logActivity(userId, 'SCHEDULE_JOB_CREATE', { jobId, fileName: originalname, scheduledAt: formattedScheduledAt });
    } catch (e) {
      console.error('Failed to log activity for SCHEDULE_JOB_CREATE:', e);
    }

    res.status(201).json({ message: 'Job scheduled successfully.', jobId });
  } catch (e) {
    console.error('Error scheduling job:', e);
    res.status(500).json({ error: 'Failed to schedule job.' });
  }
});

app.get('/api/schedules', requireAuth, async (req, res) => {
  try {
    const jobs = req.session.user.role === 'Admin'
      ? await listScheduledJobs()
      : await listScheduledJobs({ userId: req.session.user.id });
    res.json(jobs);
  } catch (e) {
    console.error('Error fetching schedules:', e);
    res.status(500).json({ error: 'Failed to fetch schedules.' });
  }
});

app.get('/api/scheduled-results', requireAuth, async (req, res) => {
  try {
    const results = req.session.user.role === 'Admin'
      ? await getScheduledResults()
      : await getScheduledResults({ userId: req.session.user.id });
    res.json(results);
  } catch (e) {
    console.error('Error fetching scheduled results:', e);
    res.status(500).json({ error: 'Failed to fetch scheduled results.' });
  }
});

app.put('/api/scheduled-results/:id', requireAuth, async (req, res) => {
  try {
    const resultId = Number(req.params.id);
    const { finalUrl, status } = req.body;
    // TODO: Add validation to ensure the user owns this result
    await updateScheduledResult({ resultId, finalUrl, status });
    res.json({ message: 'Result updated successfully.' });
  } catch (e) {
    console.error('Error updating scheduled result:', e);
    res.status(500).json({ error: 'Failed to update result.' });
  }
});

// Delete all scheduled results for a user
app.delete('/api/scheduled-results/all', requireAuth, async (req, res) => {
  try {
    await deleteAllScheduledResults({ userId: req.session.user.id });
    res.json({ message: 'All scheduled results deleted successfully.' });
  } catch (e) {
    console.error('Error deleting all scheduled results:', e);
    res.status(500).json({ error: 'Failed to delete all scheduled results.' });
  }
});

// Delete a specific scheduled job
app.delete('/api/schedules/:id', requireAuth, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    await deleteScheduledJob({ jobId, userId: req.session.user.id });
    res.json({ message: 'Scheduled job deleted successfully.' });
  } catch (e) {
    console.error('Error deleting scheduled job:', e);
    res.status(500).json({ error: 'Failed to delete scheduled job.' });
  }
});

// IP endpoint
app.get('/ip', requireAuth, (req, res) => {
  const rawIp =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    req.ip;

  // Remove IPv6 prefix if present
  const clientIp = rawIp?.replace(/^::ffff:/, '');

  console.log(`Client IP: ${clientIp}`);
  res.send({ ip : clientIp });
});

app.get('/puppeteer-status', async (req, res) => {
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: getBrowserWss("US") });
    const page = await browser.newPage();
    await page.close();
    await browser.disconnect();
    res.json({ status: "ok", message: "Puppeteer connection is working." });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Keep-alive endpoint for external cron
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Service is alive'
  });
});

const POLLING_INTERVAL = 10000; // 10 seconds

async function processJob(job) {
  console.log(`Processing job ${job.id}...`);
  await updateJobStatus({ jobId: job.id, status: 'processing' });

  let resolvedCount = 0;
  let totalCount = 0;
  let failedCount = 0;

  try {
    // Parse file data (your existing code)
    let data = [];
    const fileContent = job.file_content;

    if (job.mime_type === 'text/csv') {
      const text = fileContent.toString('utf-8');
      const lines = text.split(/\r?\n/);
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());

      const urlIndex = headers.findIndex(h => h.includes('url') || h.includes('link') || h.includes('campaign'));
      const notesIndex = headers.findIndex(h => h.includes('tag') || h.includes('note') || h.includes('description'));
      const countryIndex = headers.findIndex(h => h.includes('country') || h.includes('location') || h.includes('region') || h.includes('geo'));
      const uaTypeIndex = headers.findIndex(h => h.includes('ua-type') || h.includes('user-agent') || h.includes('ua'));

      if (urlIndex === -1) throw new Error('No URL column found in CSV.');

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(','); // Simple split, assuming no commas in values

        if (values.length > urlIndex && values[urlIndex]) {
          data.push({
            url: values[urlIndex]?.trim(),
            notes: notesIndex !== -1 ? values[notesIndex]?.trim() : '',
            country: countryIndex !== -1 ? values[countryIndex]?.trim() : 'US',
            uaType: uaTypeIndex !== -1 ? values[uaTypeIndex]?.trim() : 'random',
          });
        }
      }

    } else if (job.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const workbook = xlsx.read(fileContent, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) throw new Error('XLSX file is empty.');

      const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
      
      const urlIndex = headers.findIndex(h => h.includes('url') || h.includes('link') || h.includes('campaign'));
      const notesIndex = headers.findIndex(h => h.includes('tag') || h.includes('note') || h.includes('description'));
      const countryIndex = headers.findIndex(h => h.includes('country') || h.includes('location') || h.includes('region') || h.includes('geo'));
      const uaTypeIndex = headers.findIndex(h => h.includes('ua-type') || h.includes('user-agent') || h.includes('ua'));

      if (urlIndex === -1) throw new Error('No URL column found in XLSX.');

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        if (row[urlIndex]) {
          data.push({
            url: String(row[urlIndex] || '').trim(),
            notes: notesIndex !== -1 ? String(row[notesIndex] || '').trim() : '',
            country: countryIndex !== -1 ? String(row[countryIndex] || 'US').trim() : 'US',
            uaType: uaTypeIndex !== -1 ? String(row[uaTypeIndex] || 'random').trim() : 'random',
          });
        }
      }
    } else {
      throw new Error(`Unsupported mime type: ${job.mime_type}`);
    }

    totalCount = data.length;
    console.log(`DIAGNOSTIC: Parsed ${totalCount} rows from the file.`);

    // Process in smaller batches to prevent connection timeout
    const BATCH_SIZE = 2; // Process 2 URLs at a time
    const DELAY_BETWEEN_BATCHES = 1200; // 1.2 seconds delay

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(data.length/BATCH_SIZE)}`);

      // Process batch with fresh connection handling
      for (const row of batch) {
        const { url, notes, country, uaType } = row;
        if (!url) continue;

        try {
          // Ensure fresh connection for each URL
          const result = await resolveWithBrowserAPI(url, country, uaType);
          
          if (!result.error) {
            resolvedCount++;
          } else {
            failedCount++;
          }

          await createScheduledResult({
            jobId: job.id,
            originalUrl: url,
            finalUrl: result.finalUrl,
            country,
            uaType,
            notes,
            status: result.error ? 'failed' : 'resolved',
            errorMessage: result.error,
          });

        } catch (e) {
          failedCount++;
          await createScheduledResult({
            jobId: job.id,
            originalUrl: url,
            country,
            uaType,
            notes,
            status: 'failed',
            errorMessage: e.message,
          });
        }
      }

      // Delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < data.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Update job status based on results
    let finalStatus;
    if (resolvedCount === totalCount) {
      finalStatus = 'completed';
    } else if (resolvedCount > 0) {
      finalStatus = 'partially_completed'; // New status for partial success
    } else {
      finalStatus = 'failed';
    }

    await updateJobStatus({ jobId: job.id, status: finalStatus });
    console.log(`Job ${job.id} completed. Success: ${resolvedCount}, Failed: ${failedCount}, Total: ${totalCount}`);
    
    //log schedule job if completed
    try {
      await logActivity(job.user_id, 'SCHEDULE_JOB_COMPLETE', { jobId: job.id, fileName: job.file_name, resolvedUrlCount: resolvedCount, totalUrlCount: totalCount });
    } catch (e) {
      console.error(job.user_id, 'SCHEDULE_JOB_FAILED:', e);
      await logActivity(job.user.id, 'SCHEDULE_JOB_FAILED', {jobId: job.id})
    }

  } catch (e) {
    console.error(`Error processing job ${job.id}:`, e);
    await updateJobStatus({ jobId: job.id, status: 'failed' });
  }
}

async function startWorker(handlePoolError) {
  console.log('Starting background worker...');
  while (true) {
    try {
      const pendingJobs = await getPendingJobs();
      if (pendingJobs.length > 0) {
        console.log(`Found ${pendingJobs.length} pending jobs.`);
        // Process one job at a time to avoid overwhelming the system
        // await processJob(pendingJobs[0]);
        try {
          await processJob(pendingJobs[0]); // also wrap inside!
        } catch (e) {
          console.error(`[Worker] Failed to process job ${job.id}:`, e);
          handlePoolError(e);
        }
      } else {
        // console.log('No pending jobs found. Waiting...');
      }
    } catch (e) {
      console.error('Error in worker loop:', e);
      handlePoolError(e);
    }
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Region-aware resolver running at http://165.232.179.108:${PORT}`);
  // startWorker();
  startWorker(handlePoolError);
});
