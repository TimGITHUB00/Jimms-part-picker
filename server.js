const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const tls = require("tls");
const { URL } = require("url");

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const BENCHMARK_DATASET_PATH = path.join(DATA_DIR, "local-benchmarks.json");
const GPU_MARKET_DATASET_PATH = path.join(DATA_DIR, "gpu-market-data.json");
const USER_BUILDS_PATH = path.join(DATA_DIR, "user-builds.json");
const APP_CONFIG_PATH = path.join(DATA_DIR, "app-config.json");
const JIMMS_BASE = "https://www.jimms.fi";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

const categories = {
  cpu: { label: "CPU", group: "000-00R", url: "/fi/Product/List/000-00R" },
  cooler: { label: "CPU Cooler", group: "000-059", url: "/fi/Product/List/000-059" },
  aio: { label: "AIO Cooler", group: "000-1KG", url: "/fi/Product/List/000-1KG" },
  gpu: { label: "Graphics Card", group: "000-00P", url: "/fi/Product/List/000-00P" },
  motherboard: { label: "Motherboard", group: "000-00H", url: "/fi/Product/List/000-00H" },
  memory: { label: "Memory", group: "000-00N", url: "/fi/Product/List/000-00N" },
  storage: { label: "Storage", group: "000-00K", url: "/fi/Product/List/000-00K" },
  case: { label: "Case", group: "000-00J", url: "/fi/Product/List/000-00J" },
  psu: { label: "Power Supply", group: "000-00U", url: "/fi/Product/List/000-00U" }
};

const cache = new Map();
const detailCache = new Map();
const cartLinkCache = new Map();
const cacheMs = 1000 * 60 * 12;
const pageSize = 100;
const maxPagesPerCategory = 30;
let localBenchmarkDatasetCache = null;
let gpuMarketDatasetCache = null;
let googleJwksCache = null;
let appConfigCache = null;

const fallbackProducts = {
  cpu: [
    product("cpu", "AMD Ryzen 7 9800X3D, AM5, 4.7 GHz, 8-Core, WOF", "100-100001084WOF", "509,90 €", "Varastossa", "AMD AM5, 8-Core, gaming CPU"),
    product("cpu", "AMD Ryzen 5 9600X, AM5, 3.9 GHz, 6-Core, WOF", "100-100001405WOF", "224,90 €", "Varastossa", "AM5, 6-Core"),
    product("cpu", "Intel Core i5-14600K, LGA1700, 3.50 GHz, 24MB, Boxed", "BX8071514600K", "251,90 €", "Varastossa", "LGA1700, unlocked")
  ],
  cooler: [
    product("cooler", "Thermalright Peerless Assassin 120 SE -prosessorijäähdytin", "PA120-SE-1700", "41,90 €", "Varastossa", "Air cooler, 120mm"),
    product("cooler", "Noctua NH-D15 chromax.black -prosessorijäähdytin", "NH-D15-CHROMAX.BLACK", "114,90 €", "Varastossa", "Dual tower air cooler"),
    product("cooler", "Thermalright Phantom Spirit 120 EVO -prosessorijäähdytin", "PHANTOM-SPIRIT-120-EVO", "59,90 €", "Varastossa", "Air cooler, 2 x 120mm")
  ],
  aio: [
    product("aio", "ARCTIC Liquid Freezer III Pro 360, 360mm AIO-nestejäähdytysratkaisu prosessorille, musta", "ACFRE00180A", "96,90 €", "Varastossa", "AIO liquid cooler, 360mm"),
    product("aio", "Asus ROG RYUJIN 240, AIO-vesijäähdytysjärjestelmä prosessorille", "90RC0030-M0UAY0", "79,90 €", "Varastossa", "AIO liquid cooler, 240mm"),
    product("aio", "ARCTIC Liquid Freezer III Pro 420, 420mm AIO-nestejäähdytysratkaisu prosessorille, musta", "ACFRE00181A", "120,90 €", "Varastossa", "AIO liquid cooler, 420mm")
  ],
  gpu: [
    product("gpu", "Asus Radeon RX 9060 XT Dual -näytönohjain, 16GB GDDR6", "DUAL-RX9060XT-16G", "459,90 €", "Varastossa", "PCIe 5.0, HDMI/2xDP"),
    product("gpu", "Asus GeForce RTX 5060 DUAL - OC Edition -näytönohjain, 8GB GDDR7", "DUAL-RTX5060-O8G", "349,90 €", "Varastossa", "PCIe 5.0, HDMI/3xDP"),
    product("gpu", "Gigabyte GeForce RTX 5070 WINDFORCE OC SFF -näytönohjain, 12GB GDDR7", "GV-N5070WF3OC-12GD", "679,90 €", "Varastossa", "PCIe 5.0, HDMI/3xDP")
  ],
  motherboard: [
    product("motherboard", "Asus PRIME B650-PLUS WIFI, ATX-emolevy", "PRIME-B650-PLUS-WIFI", "129,90 €", "Varastossa", "AM5, AMD B650, 4 x DDR5, Wi-Fi 6E"),
    product("motherboard", "Asus PRIME A520M-K, mATX-emolevy", "PRIME-A520M-K", "63,90 €", "Varastossa", "AM4, AMD A520, 2 x DDR4"),
    product("motherboard", "Asus ROG STRIX X870-F GAMING WIFI, ATX-emolevy", "ROG-STRIX-X870-F-GAMING-WIFI", "429,90 €", "Varastossa", "AM5, AMD X870, Wi-Fi 7")
  ],
  memory: [
    product("memory", "Kingston 32GB (2 x 16GB) FURY Beast, DDR5 6000MHz, CL30, musta", "KF560C30BBEK2-32", "519,90 €", "Varastossa", "DDR5, 6000MHz, CL30"),
    product("memory", "Kingston 16GB (2 x 8GB) FURY Beast, DDR4 3200MHz, CL16, musta", "KF432C16BBK2/16", "179,90 €", "Varastossa", "DDR4, 3200MHz, CL16"),
    product("memory", "Kingston 64GB (2 x 32GB) FURY Beast, DDR5 6000MHz, CL36, musta", "KF560C36BBEK2-64", "799,90 €", "Varastossa", "DDR5, 6000MHz, 64GB")
  ],
  storage: [
    product("storage", "Sandisk 2TB WD_BLACK SN7100 NVMe SSD -levy, M.2 2280", "WDS200T4X0E-00CJA0", "294,90 €", "Varastossa", "PCIe 4.0 x4, 7250/6900 MB/s"),
    product("storage", "Kingston 1TB NV3 PCIe 4.0 NVMe SSD-levy, M.2 2280", "SNV3S/1000G", "199,90 €", "Varastossa", "6000/4000 MB/s"),
    product("storage", "Samsung 2TB 990 PRO, PCIe 4.0 NVMe M.2 2280 SSD-levy", "MZ-V9P2T0BW", "269,90 €", "Varastossa", "7450/6900 MB/s")
  ],
  case: [
    product("case", "Kolink Observatory HF Mesh ARGB, ikkunallinen miditornikotelo, musta", "OBSERVATORY-HF-MESH-BLACK", "52,90 €", "Varastossa", "Mid tower, mesh, ARGB"),
    product("case", "Lian Li LANCOOL 217, ikkunallinen miditornikotelo, musta", "LAN217X", "119,90 €", "Varastossa", "Mid tower, tempered glass"),
    product("case", "Phanteks XT Pro Ultra - Black, ikkunallinen miditornikotelo, musta", "PH-XT523P1_DBK01", "79,90 €", "Varastossa", "Mid tower, airflow")
  ],
  psu: [
    product("psu", "Corsair 850W RM850x (2024), ATX-virtalähde, 80 Plus Gold, musta", "CP-9020270-EU", "156,90 €", "Varastossa", "ATX 3.1 + PCIe 5.1"),
    product("psu", "Asus 850W TUF Gaming Gold, ATX-virtalähde, 80 Plus Gold, musta", "90YE00S2-B0NA00", "133,90 €", "Varastossa", "850W, 80 Plus Gold"),
    product("psu", "Asus 1000W TUF Gaming Gold, ATX-virtalähde, 80 Plus Gold, musta", "90YE00S1-B0NA00", "129,90 €", "Varastossa", "1000W, 80 Plus Gold")
  ]
};

function product(category, name, sku, price, availability, description) {
  const item = {
    id: `${category}-${sku}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    category,
    name,
    brand: firstMatch(name, /^([A-Za-z0-9]+)/) || "",
    sku,
    price,
    availability,
    description,
    sourceUrl: `${JIMMS_BASE}${categories[category]?.url || "/fi/Product/Komponentit"}`,
    productId: null,
    productGuid: null
  };
  item.specs = deriveSpecs(item);
  return item;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  });
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&Auml;/g, "\u00c4")
    .replace(/&Ouml;/g, "\u00d6")
    .replace(/&auml;/g, "\u00e4")
    .replace(/&ouml;/g, "\u00f6")
    .replace(/&euro;/g, "€")
    .replace(/&#196;/g, "Ä")
    .replace(/&#214;/g, "Ö")
    .replace(/&#228;/g, "ä")
    .replace(/&#246;/g, "ö");
}

function stripHtml(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(h[1-6]|p|li|div|span|td|th|a|button|strong|br)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function textFromHtml(html) {
  return stripHtml(html).join("\n");
}

function loadLocalBenchmarkDataset() {
  if (localBenchmarkDatasetCache) return localBenchmarkDatasetCache;
  const raw = fs.readFileSync(BENCHMARK_DATASET_PATH, "utf8");
  localBenchmarkDatasetCache = JSON.parse(raw);
  return localBenchmarkDatasetCache;
}

function loadGpuMarketDataset() {
  if (gpuMarketDatasetCache) return gpuMarketDatasetCache;
  const raw = fs.readFileSync(GPU_MARKET_DATASET_PATH, "utf8");
  gpuMarketDatasetCache = JSON.parse(raw);
  return gpuMarketDatasetCache;
}

function normalizeBenchmarkText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatEuro(value) {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0).replace(/\u00a0/g, " ");
}

function parsePriceNumber(value) {
  return Number(String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")) || 0;
}

function ensureDataFile(filePath, initialValue) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialValue, null, 2), "utf8");
  }
}

function loadUserBuildStore() {
  ensureDataFile(USER_BUILDS_PATH, { users: {}, accountsByEmail: {}, accountsByUsername: {}, sessions: {}, mailboxByEmail: {}, resetTokensByEmail: {} });
  const store = JSON.parse(fs.readFileSync(USER_BUILDS_PATH, "utf8"));
  store.users = store.users || {};
  store.accountsByEmail = store.accountsByEmail || {};
  store.accountsByUsername = store.accountsByUsername || {};
  store.sessions = store.sessions || {};
  store.mailboxByEmail = store.mailboxByEmail || {};
  store.resetTokensByEmail = store.resetTokensByEmail || {};
  let changed = false;
  const usernameMap = {};

  Object.entries(store.users).forEach(([userId, record]) => {
    record.profile = record.profile || {};
    const email = normalizeEmail(record.profile.email || "");
    if (email && store.accountsByEmail[email] !== userId) {
      store.accountsByEmail[email] = userId;
      changed = true;
    }

    let username = sanitizeUsername(record.profile.username || record.profile.name || email.split("@")[0] || `user-${userId.slice(-6)}`);
    let uniqueUsername = username;
    let suffix = 2;
    while (usernameMap[uniqueUsername] && usernameMap[uniqueUsername] !== userId) {
      uniqueUsername = `${username}-${suffix}`;
      suffix += 1;
    }

    if (record.profile.username !== uniqueUsername || record.profile.name !== uniqueUsername) {
      record.profile.username = uniqueUsername;
      record.profile.name = uniqueUsername;
      changed = true;
    }

    usernameMap[uniqueUsername] = userId;
    if (store.accountsByUsername[uniqueUsername.toLowerCase()] !== userId) {
      store.accountsByUsername[uniqueUsername.toLowerCase()] = userId;
      changed = true;
    }

    if (email && ensureWelcomeMailboxMessage(store, buildLocalUser(userId, record))) {
      changed = true;
    }
  });

  if (changed) {
    saveUserBuildStore(store);
  }
  return store;
}

function loadAppConfig() {
  if (appConfigCache) return appConfigCache;
  ensureDataFile(APP_CONFIG_PATH, {
    googleClientId: "",
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smtpFromName: "Jimms Part Picker"
  });
  appConfigCache = JSON.parse(fs.readFileSync(APP_CONFIG_PATH, "utf8"));
  return appConfigCache;
}

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || loadAppConfig().googleClientId || "";
}

function saveAppConfig(config) {
  ensureDataFile(APP_CONFIG_PATH, {
    googleClientId: "",
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smtpFromName: "Jimms Part Picker"
  });
  appConfigCache = {
    googleClientId: String(config.googleClientId || "").trim(),
    smtpHost: String(config.smtpHost || "").trim(),
    smtpPort: Number(config.smtpPort) || 465,
    smtpSecure: config.smtpSecure !== false,
    smtpUser: String(config.smtpUser || "").trim(),
    smtpPass: String(config.smtpPass || ""),
    smtpFrom: String(config.smtpFrom || "").trim(),
    smtpFromName: String(config.smtpFromName || "Jimms Part Picker").trim() || "Jimms Part Picker"
  };
  fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(appConfigCache, null, 2), "utf8");
}

function saveUserBuildStore(store) {
  ensureDataFile(USER_BUILDS_PATH, { users: {}, accountsByEmail: {}, accountsByUsername: {}, sessions: {}, mailboxByEmail: {}, resetTokensByEmail: {} });
  fs.writeFileSync(USER_BUILDS_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeUsername(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
  return cleaned || "user";
}

function normalizeUsername(value) {
  return sanitizeUsername(value).toLowerCase();
}

function getEmailConfig() {
  const config = loadAppConfig();
  return {
    host: String(process.env.SMTP_HOST || config.smtpHost || "").trim(),
    port: Number(process.env.SMTP_PORT || config.smtpPort || 465),
    secure: String(process.env.SMTP_SECURE || config.smtpSecure).toLowerCase() !== "false",
    user: String(process.env.SMTP_USER || config.smtpUser || "").trim(),
    pass: String(process.env.SMTP_PASS || config.smtpPass || ""),
    from: String(process.env.SMTP_FROM || config.smtpFrom || "").trim(),
    fromName: String(process.env.SMTP_FROM_NAME || config.smtpFromName || "Jimms Part Picker").trim() || "Jimms Part Picker"
  };
}

function isEmailDeliveryConfigured() {
  const config = getEmailConfig();
  return Boolean(config.host && config.port && config.from);
}

function sanitizeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function quotedAddress(name, email) {
  const safeName = sanitizeHeader(name);
  const safeEmail = sanitizeHeader(email);
  return safeName ? `"${safeName.replace(/"/g, "'")}" <${safeEmail}>` : `<${safeEmail}>`;
}

function dotStuff(text) {
  return String(text || "")
    .replace(/\r?\n/g, "\r\n")
    .replace(/^\./gm, "..");
}

function buildEmailMessage({ fromName, fromEmail, toEmail, subject, text }) {
  const headers = [
    `From: ${quotedAddress(fromName, fromEmail)}`,
    `To: <${sanitizeHeader(toEmail)}>`,
    `Subject: ${sanitizeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    `Date: ${new Date().toUTCString()}`
  ];
  return `${headers.join("\r\n")}\r\n\r\n${dotStuff(text)}\r\n.`;
}

function buildWelcomeEmail(username, email) {
  return {
    subject: "Welcome to Jimms Part Picker",
    text: `Hi ${username},

Your Jimms Part Picker account is ready.

Username: ${username}
Email: ${email}

You can now sign in and save named builds to your account.`
  };
}

function buildResetEmail(email, code, expiresAt) {
  return {
    subject: "Jimms Part Picker password reset",
    text: `We received a password reset request for ${email}.

Your reset code is: ${code}

This code expires at ${expiresAt}.

If you did not request this, you can ignore this email.`
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function appendMailboxMessage(store, email, subject, body) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  if (!store.mailboxByEmail[normalizedEmail]) {
    store.mailboxByEmail[normalizedEmail] = [];
  }
  store.mailboxByEmail[normalizedEmail].unshift({
    id: crypto.randomUUID(),
    subject,
    body,
    createdAt: new Date().toISOString()
  });
  store.mailboxByEmail[normalizedEmail] = store.mailboxByEmail[normalizedEmail].slice(0, 20);
}

function listMailboxMessages(store, email) {
  return [...(store.mailboxByEmail[normalizeEmail(email)] || [])];
}

function ensureWelcomeMailboxMessage(store, user) {
  const email = normalizeEmail(user.email);
  if (!email || user.authProvider !== "local") return false;
  const existing = listMailboxMessages(store, email);
  if (existing.some((message) => message.subject === "Welcome to Jimms Part Picker")) {
    return false;
  }
  appendMailboxMessage(
    store,
    email,
    "Welcome to Jimms Part Picker",
    `Hi ${user.username || user.name},\n\nYour local Jimms Part Picker account is ready. You can now save named builds to this account and keep editing your current list after a refresh.\n\nUsername: ${user.username || user.name}\nEmail: ${email}\n\nHave fun building.`
  );
  return true;
}

function createSmtpSession(config) {
  return new Promise((resolve, reject) => {
    const socket = config.secure
      ? tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host
      })
      : net.createConnection({
        host: config.host,
        port: config.port
      });

    let buffer = "";
    let closed = false;
    const waiters = [];

    function fail(error) {
      if (closed) return;
      closed = true;
      while (waiters.length > 0) {
        waiters.shift().reject(error);
      }
      socket.destroy();
      reject(error);
    }

    function consume() {
      while (waiters.length > 0) {
        const response = readResponseFromBuffer();
        if (!response) break;
        waiters.shift().resolve(response);
      }
    }

    function readResponseFromBuffer() {
      const lines = buffer.split("\r\n");
      if (lines.length < 2) return null;

      const collected = [];
      for (let index = 0; index < lines.length - 1; index += 1) {
        const line = lines[index];
        if (!/^\d{3}[ -]/.test(line)) return null;
        collected.push(line);
        if (/^\d{3} /.test(line)) {
          buffer = lines.slice(index + 1).join("\r\n");
          const code = Number(collected[collected.length - 1].slice(0, 3));
          return {
            code,
            lines: collected,
            text: collected.map((entry) => entry.slice(4)).join("\n")
          };
        }
      }

      return null;
    }

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      consume();
    });
    socket.on("error", fail);
    socket.on("close", () => {
      if (!closed) {
        fail(new Error("SMTP connection closed unexpectedly."));
      }
    });

    const connectedEvent = config.secure ? "secureConnect" : "connect";
    socket.once(connectedEvent, async () => {
      try {
        async function nextResponse() {
          const ready = readResponseFromBuffer();
          if (ready) return ready;
          return await new Promise((resolveNext, rejectNext) => {
            waiters.push({ resolve: resolveNext, reject: rejectNext });
          });
        }

        async function expect(codePrefix, command, options = {}) {
          if (command) {
            socket.write(`${command}\r\n`);
          }
          const response = await nextResponse();
          if (!String(response.code).startsWith(String(codePrefix))) {
            const details = options.redactResponse ? "" : ` ${response.text}`.trimEnd();
            throw new Error(`${options.label || "SMTP command"} failed with ${response.code}${details ? `: ${details}` : ""}`);
          }
          return response;
        }

        const greeting = await expect(220, null, { label: "SMTP greeting" });
        void greeting;
        await expect(250, `EHLO ${sanitizeHeader(os.hostname() || "localhost")}`, { label: "SMTP EHLO" });
        if (config.user) {
          const authPayload = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString("base64");
          await expect(235, `AUTH PLAIN ${authPayload}`, { label: "SMTP AUTH", redactResponse: true });
        }

        resolve({
          send: async ({ from, to, subject, text }) => {
            await expect(250, `MAIL FROM:<${sanitizeHeader(from)}>`, { label: "SMTP MAIL FROM" });
            await expect(250, `RCPT TO:<${sanitizeHeader(to)}>`, { label: "SMTP RCPT TO" });
            await expect(354, "DATA", { label: "SMTP DATA" });
            const message = buildEmailMessage({
              fromName: config.fromName,
              fromEmail: from,
              toEmail: to,
              subject,
              text
            });
            socket.write(`${message}\r\n`);
            await expect(250, null, { label: "SMTP message body" });
          },
          close: async () => {
            if (closed) return;
            closed = true;
            try {
              socket.write("QUIT\r\n");
            } finally {
              socket.end();
            }
          }
        });
      } catch (error) {
        fail(error);
      }
    });
  });
}

async function sendEmailMessage({ to, subject, text }) {
  const config = getEmailConfig();
  if (!isEmailDeliveryConfigured()) {
    throw new Error("Email delivery is not configured. Set SMTP settings in data/app-config.json or SMTP_* environment variables.");
  }

  const session = await createSmtpSession(config);
  try {
    await session.send({
      from: config.from,
      to,
      subject,
      text
    });
  } finally {
    await session.close();
  }
}

function toBase64UrlBuffer(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function decodeJwtPart(value) {
  return JSON.parse(toBase64UrlBuffer(value).toString("utf8"));
}

async function fetchGoogleJwks() {
  if (googleJwksCache && Date.now() < googleJwksCache.expiresAt) {
    return googleJwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL, {
    headers: {
      "User-Agent": "JimmsPartPicker/1.0 (+local development)"
    }
  });

  if (!response.ok) {
    throw new Error(`Google JWK fetch failed with ${response.status}`);
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 1000 * 60 * 60;
  const body = await response.json();
  googleJwksCache = {
    keys: body.keys || [],
    expiresAt: Date.now() + maxAgeMs
  };

  return googleJwksCache.keys;
}

async function verifyGoogleIdToken(idToken) {
  const googleClientId = getGoogleClientId();
  if (!googleClientId) {
    throw new Error("Google sign-in is not configured. Set googleClientId in data/app-config.json.");
  }

  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed Google ID token.");
  }

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Google ID token format.");
  }

  const keys = await fetchGoogleJwks();
  const jwk = keys.find((entry) => entry.kid === header.kid);
  if (!jwk) {
    throw new Error("Google signing key not found for token.");
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const isValid = verifier.verify(
    crypto.createPublicKey({ key: jwk, format: "jwk" }),
    toBase64UrlBuffer(parts[2])
  );

  if (!isValid) {
    throw new Error("Google ID token signature is invalid.");
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error("Google ID token issuer is invalid.");
  }

  if (payload.aud !== googleClientId) {
    throw new Error("Google ID token audience does not match this app.");
  }

  if (!payload.exp || (Number(payload.exp) * 1000) <= Date.now()) {
    throw new Error("Google ID token has expired.");
  }

  return {
    sub: String(payload.sub),
    email: payload.email || "",
    name: payload.name || payload.email || "Google user",
    picture: payload.picture || "",
    emailVerified: Boolean(payload.email_verified),
    authProvider: "google"
  };
}

function createLocalSession(store, userId) {
  const sessionId = crypto.randomBytes(24).toString("hex");
  store.sessions[sessionId] = {
    userId,
    createdAt: new Date().toISOString()
  };
  return `local_${sessionId}`;
}

function buildLocalUser(userId, record) {
  return {
    sub: userId,
    email: record.profile?.email || "",
    username: record.profile?.username || record.profile?.name || record.profile?.email || "User",
    name: record.profile?.username || record.profile?.name || record.profile?.email || "User",
    picture: record.profile?.picture || "",
    emailVerified: true,
    authProvider: "local"
  };
}

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error("Missing sign-in token.");
  }

  const token = match[1];
  if (token.startsWith("local_")) {
    const sessionId = token.slice("local_".length);
    const store = loadUserBuildStore();
    const session = store.sessions[sessionId];
    if (!session || !store.users[session.userId]) {
      throw new Error("Local session has expired.");
    }
    return buildLocalUser(session.userId, store.users[session.userId]);
  }

  return verifyGoogleIdToken(token);
}

function buildRecordSummary(record) {
  return {
    id: record.id,
    name: record.name,
    parts: record.parts || {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function getUserBuilds(store, user) {
  if (!store.users[user.sub]) {
    store.users[user.sub] = {
      profile: {
        email: user.email,
        username: user.username || user.name,
        name: user.name,
        picture: user.picture,
        authProvider: user.authProvider || "google"
      },
      builds: []
    };
  } else {
    store.users[user.sub].profile = {
      email: user.email,
      username: user.username || store.users[user.sub].profile?.username || user.name,
      name: user.name,
      picture: user.picture,
      authProvider: user.authProvider || store.users[user.sub].profile?.authProvider || "google"
    };
  }

  return store.users[user.sub].builds;
}

function normalizeSocket(value) {
  if (!value) return null;
  return value.toUpperCase().replace(/\s+/g, "");
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1] || match[0] : null;
}

function detectSocket(text) {
  return normalizeSocket(firstMatch(text, /\b(AM[45]|LGA\s?\d{4,5}|STR5|STRX4|TR4|SP3)\b/i));
}

function detectMemoryType(text) {
  const match = text.match(/\bDDR[3-6]\b/i);
  return match ? match[0].toUpperCase() : null;
}

function detectMotherboardFormFactor(text) {
  if (/\b(E-ATX|EATX)\b/i.test(text)) return "E-ATX";
  if (/\b(Micro-ATX|mATX)\b/i.test(text)) return "mATX";
  if (/\b(Mini-ITX|ITX)\b/i.test(text)) return "Mini-ITX";
  if (/\bATX\b/i.test(text)) return "ATX";
  return null;
}

function detectCaseFormFactors(text) {
  if (/\b(Mini-ITX|Mini ITX|ITX)\b/i.test(text)) return ["Mini-ITX"];
  if (/\b(mATX|Micro-ATX|Micro ATX)\b/i.test(text)) return ["mATX", "Mini-ITX"];
  if (/\b(E-ATX|EATX|Full-torni|Full tower)\b/i.test(text)) return ["E-ATX", "ATX", "mATX", "Mini-ITX"];
  if (/\b(ATX|Midi|Miditorn|Mid tower)\b/i.test(text)) return ["ATX", "mATX", "Mini-ITX"];
  return [];
}

function detectPsuWattage(text) {
  const match = text.match(/\b(\d{3,4})\s*W\b/i);
  return match ? Number(match[1]) : null;
}

function detectCpuFrequency(text) {
  const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*GHz\b/i);
  return match ? `${match[1].replace(",", ".")} GHz` : null;
}

function detectCpuCores(text) {
  const match = text.match(/\b(\d{1,2})\s*-?\s*Core\b/i);
  return match ? `${match[1]}-Core` : null;
}

function detectPackageType(text) {
  if (/\bBoxed\b/i.test(text)) return "Boxed";
  if (/\bWOF\b/i.test(text)) return "WOF";
  return null;
}

function detectColorDescriptor(text) {
  const match = text.match(/,\s*([^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*)$/i);
  return match ? match[1].trim() : null;
}

function detectMemorySpeed(text) {
  const match = text.match(/\bDDR[3-6]\s*(\d{3,5})\s*MHz\b/i) || text.match(/\b(\d{3,5})\s*MHz\b/i);
  return match ? `${match[1]}MHz` : null;
}

function detectCasLatency(text) {
  const match = text.match(/\bCL\s?(\d+)\b/i);
  return match ? `CL${match[1]}` : null;
}

function detectVoltage(text) {
  const match = text.match(/\b\d+(?:[.,]\d+)?\s*V\b/i);
  return match ? match[0].replace(",", ".").replace(/\s+/g, "") : null;
}

function detectStorageFormFactor(text) {
  if (/\bM\.2\s*2280\b/i.test(text)) return "M.2 2280";
  if (/\bM\.2\b/i.test(text)) return "M.2";
  if (/\b2\.5[”"]?\b|\b2,5[”"]?\b/i.test(text)) return "2.5-inch";
  if (/\b3\.5[”"]?\b|\b3,5[”"]?\b/i.test(text)) return "3.5-inch";
  return null;
}

function detectStorageInterface(text) {
  if (/\bNVMe\b/i.test(text)) return "NVMe";
  if (/\bSATA\b/i.test(text)) return "SATA";
  if (/\bPCIe\s*\d(?:\.\d)?(?:\s*x\d+)?\b/i.test(text)) return firstMatch(text, /\bPCIe\s*\d(?:\.\d)?(?:\s*x\d+)?\b/i).replace(/\s+/g, " ");
  return null;
}

function detectPsuEfficiency(text) {
  const match = text.match(/\b80\s*Plus\s*(Bronze|Silver|Gold|Platinum|Titanium)\b/i);
  return match ? `80 Plus ${match[1]}` : null;
}

function detectPsuModularity(text) {
  if (/täysmodulaarinen|fully modular/i.test(text)) return "Fully modular";
  if (/puolimodulaarinen|semi[-\s]?modular/i.test(text)) return "Semi-modular";
  if (/modulaarinen|modular/i.test(text)) return "Modular";
  return null;
}

function detectRadiatorSize(text) {
  const match = text.match(/\b(120|140|240|280|360|420)\s*mm\b/i);
  return match ? Number(match[1]) : null;
}

function extractRadiatorSizes(text) {
  const sizes = new Set();
  for (const match of text.matchAll(/\b(120|140|240|280|360|420)\s*mm\b/gi)) {
    sizes.add(Number(match[1]));
  }
  for (const match of text.matchAll(/\b((?:120|140|240|280|360|420)(?:\s*\/\s*(?:120|140|240|280|360|420))+)\s*mm\b/gi)) {
    match[1].split(/\s*\/\s*/).forEach((size) => sizes.add(Number(size)));
  }
  return [...sizes].sort((a, b) => b - a);
}

function detectCaseRadiatorSupport(text) {
  const support = new Map();
  const radiatorTerms = /radiator|j.{1,6}hdytin|vesij.{1,6}hdytys|nestej.{1,6}hdytys|liquid cooling/i;
  const locationPatterns = [
    ["front", /\b(front|etu|edess.{1,3})\b/i],
    ["top", /\b(top|katto|katossa|yl.{1,3}osa|ylh.{1,6}ll.{1,3})\b/i],
    ["rear", /\b(rear|taka|takana)\b/i],
    ["bottom", /\b(bottom|pohja|pohjassa)\b/i],
    ["side", /\b(side|sivu|sivulla)\b/i]
  ];

  function add(location, size) {
    if (!support.has(location)) support.set(location, new Set());
    support.get(location).add(size);
  }

  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  let radiatorContext = 0;
  for (const line of lines) {
    if (radiatorTerms.test(line)) radiatorContext = 30;
    const isRelevant = radiatorContext > 0 || radiatorTerms.test(line);
    if (!isRelevant) continue;
    radiatorContext -= 1;

    const sizes = extractRadiatorSizes(line);
    if (sizes.length === 0) continue;

    const locations = locationPatterns
      .filter(([, pattern]) => pattern.test(line))
      .map(([location]) => location);

    for (const size of sizes) {
      if (locations.length === 0) {
        add("listed", size);
      } else {
        locations.forEach((location) => add(location, size));
      }
    }
  }

  return [...support.entries()]
    .map(([location, sizes]) => ({ location, sizes: [...sizes].sort((a, b) => b - a) }))
    .sort((a, b) => (b.sizes[0] || 0) - (a.sizes[0] || 0));
}

function detectCoolerType(text, category) {
  if (category === "aio" || /\b(AIO|nestejäähdytys|vesijäähdytys|liquid)\b/i.test(text)) return "AIO";
  return "Air";
}

function detectSupportedSockets(text) {
  const sockets = new Set();
  const normalized = text.replace(/\b115X\b/gi, "LGA115x").replace(/\b20XX\b/gi, "LGA20xx");
  for (const match of normalized.matchAll(/\b(AM[2-5]|FM[12]|LGA\s?\d{3,5}x?|TR4|sTRX4|STRX4|STR5|SP3|1200|1700|1851|1150|1151|1155|1156|2011|2066)\b/gi)) {
    let socket = match[1].toUpperCase().replace(/\s+/g, "");
    if (/^\d/.test(socket)) socket = `LGA${socket}`;
    if (socket === "STRX4") socket = "sTRX4";
    sockets.add(socket);
  }
  return [...sockets];
}

function detectHeatRating(text) {
  const patterns = [
    /\b(?:TDP|lämpöteho|heat\s*rating|cooling\s*capacity)[^\d]{0,30}(\d{2,4})\s*W\b/i,
    /\b(\d{2,4})\s*W\s*(?:TDP|lämpöteho|heat\s*rating|cooling\s*capacity)\b/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function detectDimensionTriples(text) {
  return [...text.matchAll(/\b(\d{2,4})\s*x\s*(\d{2,4})\s*x\s*(\d{2,4})\s*mm\b/gi)]
    .map((match) => match.slice(1, 4).map(Number));
}

function firstTripleAfterLabel(text, labelPattern) {
  const match = text.match(new RegExp(`(?:${labelPattern.source})[\\s:]*([\\s\\S]{0,80})`, "i"));
  if (!match) return null;
  const triple = match[1].match(/(\d{2,4})\s*x\s*(\d{2,4})\s*x\s*(\d{2,4})\s*mm/i);
  return triple ? triple.slice(1, 4).map(Number) : null;
}

function firstNumberAfterLabel(text, labelPattern, limit = 120) {
  const match = text.match(new RegExp(`(?:${labelPattern.source})[\\s\\S]{0,${limit}}?(\\d{2,4})\\s*mm`, "i"));
  return match ? Number(match[1]) : null;
}

function inferCoolerCapacity(text, category) {
  const radiatorSize = detectRadiatorSize(text);
  if (category === "aio" || /\b(AIO|nestejäähdytys|vesijäähdytys|liquid)\b/i.test(text)) {
    if (radiatorSize >= 360) return { tier: "high", label: `${radiatorSize}mm AIO class` };
    if (radiatorSize >= 240) return { tier: "medium", label: `${radiatorSize}mm AIO class` };
    if (radiatorSize) return { tier: "entry", label: `${radiatorSize}mm AIO class` };
    return { tier: "medium", label: "AIO class" };
  }

  if (/NH-D15|Peerless Assassin|Phantom Spirit|dual tower|kaksoistorni|2\s*x\s*120mm/i.test(text)) {
    return { tier: "high", label: "high-capacity air cooler class" };
  }

  if (/tower|tornimallinen|120mm/i.test(text)) {
    return { tier: "medium", label: "tower air cooler class" };
  }

  return { tier: "unknown", label: "air cooler class" };
}

function extractDescriptionHtml(html) {
  const match = html.match(/<div itemprop="description">([\s\S]*?)<\/div>\s*<div class="my-2">/i)
    || html.match(/<div itemprop="description">([\s\S]*?)<\/div>/i);
  if (match) return match[1];

  const meta = html.match(/<meta\s+(?:property|name)="(?:og:description|description)"\s+content="([^"]*)"/i);
  return meta ? meta[1] : "";
}

function extractMetaTitle(html) {
  const match = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)
    || html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]) : "";
}

function extractCaseSpecText(html, detailText) {
  const markers = [
    "J&auml;&auml;hdytintuki",
    "Jäähdytintuki",
    "JÃ¤Ã¤hdytintuki",
    "Radiator support"
  ];
  const index = markers
    .map((marker) => html.indexOf(marker))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0];

  if (index === undefined) return detailText || "";

  const slice = html.slice(Math.max(0, index - 120), index + 1400);
  return `${detailText || ""}\n${textFromHtml(slice)}`;
}

function parseMotherboardDetails(text) {
  const specs = {};
  const pcieSlots = [...new Set([...text.matchAll(/\b\d+\s*x\s*PCIe\s*\d(?:\.\d)?\s*x\d+\s*slots?(?:\s*\([^)]*\))?/gi)].map((match) => match[0].replace(/\s+/g, " ")))];
  const m2SlotMap = new Map();
  for (const match of text.matchAll(/\b(M\.2_\d+)\s*slot[^\n<]*/gi)) {
    const slotId = match[1].toUpperCase();
    if (!m2SlotMap.has(slotId)) {
      m2SlotMap.set(slotId, match[0].replace(/\s+/g, " ").trim());
    }
  }
  let m2Slots = [...m2SlotMap.values()];
  if (m2Slots.length === 0) {
    const summary = text.match(/\b(\d+)\s*x?\s*M\.2[-\s]?paikkaa\b/i);
    if (summary) {
      m2Slots = Array.from({ length: Number(summary[1]) }, (_, index) => `M.2 slot ${index + 1}`);
    }
  }
  const sataMatch = text.match(/\b(\d+)\s*x\s*SATA\s*6Gb\/s\s*ports?\b/i);
  const memoryMatch = text.match(/\b(\d+)\s*x\s*DDR[3-6]\s*DIMM\b/i) || text.match(/\b(\d+)x\s*DDR[3-6]\s*muistipaikkaa\b/i);

  if (pcieSlots.length > 0) specs.pcieSlots = pcieSlots.slice(0, 6);
  if (m2Slots.length > 0) specs.m2Slots = m2Slots.slice(0, 6);
  if (sataMatch) specs.sataPorts = Number(sataMatch[1]);
  if (memoryMatch) specs.memorySlots = Number(memoryMatch[1]);

  return specs;
}

function parseCoolerDetails(text) {
  const specs = {};
  const supportedSockets = detectSupportedSockets(text);
  const heatRating = detectHeatRating(text);
  const inferredCapacity = inferCoolerCapacity(text, /\b(AIO|nestejäähdytys|vesijäähdytys|liquid)\b/i.test(text) ? "aio" : "cooler");

  if (supportedSockets.length > 0) specs.supportedSockets = supportedSockets;
  if (heatRating) specs.heatRating = heatRating;
  specs.inferredCapacity = inferredCapacity;

  return specs;
}

function parseCaseDetails(text) {
  const specs = {};
  const radiatorSupport = detectCaseRadiatorSupport(text);

  if (radiatorSupport.length > 0) {
    specs.radiatorSupport = radiatorSupport;
    specs.maxRadiatorSize = Math.max(...radiatorSupport.flatMap((mount) => mount.sizes));
  }

  return specs;
}

function parseCoolerPhysicalDetails(text) {
  const specs = {};
  const isAio = /\b(AIO|nestej.{1,6}hdytys|vesij.{1,6}hdytys|liquid)\b/i.test(text);
  const dimensions = firstTripleAfterLabel(text, /Mitat\s*\(PxLxK\)|Mitat|Dimensions|Koko/) || detectDimensionTriples(text)[0];

  if (!isAio && dimensions) {
    specs.coolerHeightMm = dimensions[2];
  }

  return specs;
}

function parseCaseClearanceDetails(text) {
  const specs = {};
  const maxGpuLengthMm = firstNumberAfterLabel(text, /N.{0,6}yt.{0,3}nohjaimen pituus|GPU length|graphics card length/);
  const maxCpuCoolerHeightMm = firstNumberAfterLabel(text, /Prosessorij.{1,10}hdyttimen korkeus|CPU cooler height|cooler height/);
  const maxPsuLengthMm = firstNumberAfterLabel(text, /Virtal.{1,6}hteen pituus|PSU length|power supply length/, 180);

  if (maxGpuLengthMm) specs.maxGpuLengthMm = maxGpuLengthMm;
  if (maxCpuCoolerHeightMm) specs.maxCpuCoolerHeightMm = maxCpuCoolerHeightMm;
  if (maxPsuLengthMm) specs.maxPsuLengthMm = maxPsuLengthMm;

  return specs;
}

function parseGpuDetails(text) {
  const specs = {};
  const dimensions = firstTripleAfterLabel(text, /Mitat|Dimensions|Koko/) || detectDimensionTriples(text)[0];

  if (dimensions) {
    specs.gpuLengthMm = dimensions[0];
  }

  return specs;
}

function parsePsuDetails(text) {
  const specs = {};
  const dimensions = firstTripleAfterLabel(text, /Mitat|Dimensions|Koko/) || detectDimensionTriples(text)[0];

  if (dimensions) {
    specs.psuLengthMm = dimensions[0];
  }

  return specs;
}

async function fetchProductDetails(category, sourceUrl) {
  if (!sourceUrl) return {};

  const parsedUrl = new URL(sourceUrl, JIMMS_BASE);
  if (parsedUrl.hostname !== "www.jimms.fi") return {};

  const cacheKey = `${category}:${parsedUrl.href}`;
  const cached = detailCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < cacheMs) {
    return cached.details;
  }

  const response = await fetch(parsedUrl.href, {
    headers: {
      "User-Agent": "JimmsPartPicker/1.0 (+local development)",
      "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Jimms.fi returned ${response.status}`);
  }

  const html = await response.text();
  const detailText = textFromHtml(extractDescriptionHtml(html));
  const titleText = extractMetaTitle(html);
  const specs = {};

  if (category === "cooler" || category === "aio") {
    Object.assign(specs, parseCoolerDetails(`${titleText}\n${detailText || ""}`));
    Object.assign(specs, parseCoolerPhysicalDetails(`${titleText}\n${detailText || ""}`));
  }

  if (category === "motherboard") {
    Object.assign(specs, parseMotherboardDetails(detailText || html));
  }

  if (category === "case") {
    const caseText = extractCaseSpecText(html, detailText);
    Object.assign(specs, parseCaseDetails(caseText));
    Object.assign(specs, parseCaseClearanceDetails(caseText));
  }

  if (category === "gpu") {
    Object.assign(specs, parseGpuDetails(`${titleText}\n${detailText || ""}`));
  }

  if (category === "psu") {
    Object.assign(specs, parsePsuDetails(`${titleText}\n${detailText || ""}`));
  }

  const details = { specs, detailSource: "jimms.fi product page" };
  detailCache.set(cacheKey, { createdAt: Date.now(), details });
  return details;
}

async function resolveCartLink(sourceUrl, productId, productGuid) {
  if (productId && productGuid) {
    const params = new URLSearchParams({
      ProductID: String(productId),
      Qty: "1",
      ProductGuid: String(productGuid)
    });
    return `${JIMMS_BASE}/fi/ShoppingCart/AddItem?${params.toString()}`;
  }

  if (!sourceUrl) return null;

  const parsedUrl = new URL(sourceUrl, JIMMS_BASE);
  if (parsedUrl.hostname !== "www.jimms.fi") return null;

  const cacheKey = `cart:${parsedUrl.href}`;
  const cached = cartLinkCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < cacheMs) {
    return cached.url;
  }

  const response = await fetch(parsedUrl.href, {
    headers: {
      "User-Agent": "JimmsPartPicker/1.0 (+local development)",
      "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Jimms.fi returned ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/href="(\/fi\/ShoppingCart\/AddItem\?ProductID=\d+&amp;Qty=\d+&amp;ProductGuid=[^"]+)"/i);
  const cartUrl = match ? `${JIMMS_BASE}${decodeHtml(match[1])}` : null;
  cartLinkCache.set(cacheKey, { createdAt: Date.now(), url: cartUrl });
  return cartUrl;
}

function estimateCpuWatts(text) {
  if (/threadripper|xeon/i.test(text)) return 280;
  if (/ryzen 9|core i9|ultra 9/i.test(text)) return 170;
  if (/ryzen 7|core i7|ultra 7/i.test(text)) return 125;
  if (/ryzen 5|core i5|ultra 5/i.test(text)) return 95;
  if (/ryzen 3|core i3/i.test(text)) return 65;
  return 95;
}

function estimateGpuWatts(text) {
  const table = [
    [/RTX\s*5090|RX\s*7900\s*XTX/i, 575],
    [/RTX\s*5080|RTX\s*4090/i, 430],
    [/RTX\s*5070\s*TI|RTX\s*4080|RX\s*9070\s*XT|RX\s*7900\s*XT/i, 330],
    [/RTX\s*5070|RTX\s*4070\s*TI|RX\s*9070|RX\s*7800\s*XT/i, 260],
    [/RTX\s*5060\s*TI|RTX\s*4070|RX\s*7700\s*XT|RX\s*9060\s*XT/i, 210],
    [/RTX\s*5060|RTX\s*4060|RX\s*7600|INTEL\s*ARC/i, 160],
    [/GTX|GEFORCE|RADEON/i, 150]
  ];
  const match = table.find(([regex]) => regex.test(text));
  return match ? match[1] : 0;
}

function inferMemoryChannels(memory) {
  const source = `${memory?.name || ""} ${memory?.description || ""}`;
  const modules = Number(firstMatch(source, /\((\d+)\s*x\s*\d+\s*GB\)/i)) || 2;
  const memoryType = memory?.specs?.memoryType || detectMemoryType(source) || "";
  return /DDR5/i.test(memoryType) ? modules * 2 : modules;
}

function inferMemoryFrequency(memory) {
  const speed = memory?.specs?.speed || detectMemorySpeed(`${memory?.name || ""} ${memory?.description || ""}`) || "";
  const match = String(speed).match(/(\d{3,5})/);
  if (match) return Number(match[1]);
  return /DDR5/i.test(memory?.specs?.memoryType || "") ? 6000 : 3200;
}

function inferBenchmarkCpuName(name) {
  const text = String(name || "");
  const amd = text.match(/\bRyzen\s+(?:Threadripper\s+)?[3579]\s+\d{4,5}[A-Z0-9-]*\b/i);
  if (amd) return amd[0].replace(/\s+/g, " ").trim();
  const intelCore = text.match(/\bCore\s+(?:Ultra\s+)?[3579][-\s]?\d{4,5}[A-Z0-9-]*\b/i);
  if (intelCore) return intelCore[0].replace(/\s+/g, " ").trim();
  return text.replace(/^AMD\s+/i, "").replace(/^Intel\s+/i, "").trim() || text;
}

function inferBenchmarkGpuName(name) {
  const text = String(name || "");
  const nvidia = text.match(/\bRTX\s*\d{4}(?:\s*Ti)?(?:\s*SUPER)?\b/i) || text.match(/\bGTX\s*\d{3,4}(?:\s*Ti)?(?:\s*SUPER)?\b/i);
  if (nvidia) return nvidia[0].replace(/\s+/g, " ").trim();
  const amd = text.match(/\bRX\s*\d{4}(?:\s*XT)?\b/i);
  if (amd) return amd[0].replace(/\s+/g, " ").trim();
  const intel = text.match(/\bArc\s+[A-Z]\d{3}\b/i);
  if (intel) return intel[0].replace(/\s+/g, " ").trim();
  return text.trim();
}

function inferGpuModelName(name) {
  return inferBenchmarkGpuName(name)
    .replace(/\s+/g, " ")
    .replace(/\bGeForce\b/gi, "")
    .replace(/\bRadeon\b/gi, "")
    .trim();
}

function classifyGpuValueTier(valueScore) {
  if (valueScore >= 0.27) return "excellent";
  if (valueScore >= 0.22) return "good";
  if (valueScore >= 0.17) return "fair";
  return "poor";
}

function classifyGpuThermalTier(thermalRating) {
  if (thermalRating >= 8.5) return "excellent";
  if (thermalRating >= 7) return "good";
  if (thermalRating >= 5.5) return "average";
  return "warm";
}

function thermalLabelForTier(tier) {
  return {
    excellent: "Cool-running",
    good: "Good thermals",
    average: "Average thermals",
    warm: "Runs warm"
  }[tier] || "Thermals unknown";
}

function labelizeTier(value) {
  return String(value || "")
    .replace(/^\w/, (char) => char.toUpperCase());
}

function scoreGpuMarketMatch(query, candidate) {
  return scoreBenchmarkHardwareMatch(query, candidate);
}

function findGpuMarketEntry(name, entries) {
  const query = String(name || "").trim();
  if (!query) return null;

  let best = null;
  let bestScore = 0;
  for (const entry of entries || []) {
    const score = scoreGpuMarketMatch(query, entry.name);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  if (!best || bestScore < 90) return null;
  return { ...best, matchScore: bestScore };
}

function buildGpuMarketSpecs(item) {
  if (item.category !== "gpu") return {};

  const dataset = loadGpuMarketDataset();
  const modelName = inferGpuModelName(item.name || item.displayName || "");
  const marketEntry = findGpuMarketEntry(modelName, dataset.gpus);
  if (!marketEntry) return {};

  const detectedVram = Number(firstMatch(`${item.name || ""} ${item.description || ""}`, /\b(\d+)\s*GB\b/i)) || null;
  const priceEur = parsePriceNumber(item.price);
  const valueScore = priceEur > 0 ? Number((marketEntry.performanceIndex / priceEur).toFixed(3)) : null;
  const valueTier = valueScore ? classifyGpuValueTier(valueScore) : null;
  const thermalTier = classifyGpuThermalTier(marketEntry.thermalRating || 0);
  const isLowVramVariant = detectedVram && marketEntry.vramGb && detectedVram < marketEntry.vramGb;
  const valueSummary = isLowVramVariant
    ? `${marketEntry.valueSummary} This specific card variant has less VRAM than the strongest version of this model.`
    : marketEntry.valueSummary || "";

  return {
    gpuModel: marketEntry.name,
    performanceIndex: marketEntry.performanceIndex,
    rayTracingIndex: marketEntry.rayTracingIndex,
    vramGb: detectedVram || marketEntry.vramGb,
    boardPowerW: marketEntry.boardPowerW,
    targetResolution: marketEntry.targetResolution,
    efficiencyTier: marketEntry.efficiencyTier,
    thermalTier,
    thermalLabel: thermalLabelForTier(thermalTier),
    thermalRating: marketEntry.thermalRating,
    valueScore,
    valueTier,
    valueLabel: valueTier ? `${labelizeTier(valueTier)} value` : null,
    valueSummary,
    strengths: marketEntry.strengths || [],
    notes: marketEntry.notes || ""
  };
}

function deriveSpecs(item) {
  const text = `${item.name || ""} ${item.description || ""} ${item.productGroupName || ""} ${item.productGroupFullName || ""}`;
  const specs = buildGpuMarketSpecs(item);

  if (item.category === "cpu") {
    specs.socket = detectSocket(text);
    specs.frequency = detectCpuFrequency(text);
    specs.cores = detectCpuCores(text);
    specs.packageType = detectPackageType(text);
    specs.estimatedWatts = estimateCpuWatts(text);
  }

  if (item.category === "cooler" || item.category === "aio") {
    specs.coolerType = detectCoolerType(text, item.category);
    specs.radiatorSize = detectRadiatorSize(text);
    specs.color = detectColorDescriptor(item.name || "");
  }

  if (item.category === "gpu") {
    specs.memoryType = /GDDR\d/i.test(text) ? firstMatch(text, /\b(GDDR\d)\b/i).toUpperCase() : null;
    specs.capacity = firstMatch(text, /\b\d+\s*(?:GB|TB)\b/i)?.replace(/\s+/g, "") || null;
    const vramMatch = specs.capacity ? specs.capacity.match(/(\d+)\s*GB/i) : null;
    if (vramMatch) specs.vramGb = Number(vramMatch[1]);
    specs.estimatedWatts = estimateGpuWatts(text);
  }

  if (item.category === "motherboard") {
    specs.socket = detectSocket(text);
    specs.memoryType = detectMemoryType(text);
    specs.formFactor = detectMotherboardFormFactor(text);
  }

  if (item.category === "memory") {
    specs.memoryType = detectMemoryType(text);
    specs.speed = detectMemorySpeed(text);
    specs.casLatency = detectCasLatency(text);
    specs.voltage = detectVoltage(text);
    specs.color = detectColorDescriptor(item.name || "");
    specs.capacityGb = Number(firstMatch(text, /\b(\d{1,4})GB\b/i)) || null;
  }

  if (item.category === "storage") {
    specs.capacity = firstMatch(text, /\b\d+\s*(?:GB|TB)\b/i)?.replace(/\s+/g, "") || null;
    specs.formFactor = detectStorageFormFactor(text);
    specs.interface = detectStorageInterface(text);
  }

  if (item.category === "case") {
    specs.supportedFormFactors = detectCaseFormFactors(text);
    specs.color = detectColorDescriptor(item.name || "");
  }

  if (item.category === "psu") {
    specs.wattage = detectPsuWattage(text);
    specs.efficiency = detectPsuEfficiency(text);
    specs.modularity = detectPsuModularity(text);
  }

  return specs;
}

function benchmarkWords(value) {
  return normalizeBenchmarkText(value)
    .split(" ")
    .filter((word) => word && !["amd", "intel", "nvidia", "geforce", "radeon", "graphics", "card", "processor"].includes(word));
}

function scoreBenchmarkHardwareMatch(query, candidate) {
  const normalizedQuery = normalizeBenchmarkText(query);
  const normalizedCandidate = normalizeBenchmarkText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedQuery === normalizedCandidate) return 1000;

  let score = 0;
  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    score += 250;
  }

  const queryWords = benchmarkWords(query);
  const candidateWords = benchmarkWords(candidate);
  const querySet = new Set(queryWords);
  const candidateSet = new Set(candidateWords);
  let shared = 0;
  querySet.forEach((word) => {
    if (candidateSet.has(word)) shared += 1;
  });
  score += shared * 35;

  const querySeries = firstMatch(normalizedQuery, /\b(\d{4,5}x?)\b/);
  const candidateSeries = firstMatch(normalizedCandidate, /\b(\d{4,5}x?)\b/);
  if (querySeries && candidateSeries && querySeries === candidateSeries) score += 220;

  const queryPrefix = firstMatch(normalizedQuery, /\b(ryzen|core|rtx|gtx|rx|arc)\b/);
  const candidatePrefix = firstMatch(normalizedCandidate, /\b(ryzen|core|rtx|gtx|rx|arc)\b/);
  if (queryPrefix && candidatePrefix && queryPrefix === candidatePrefix) score += 80;

  if (/x3d/.test(normalizedQuery) && /x3d/.test(normalizedCandidate)) score += 50;
  if (/\bti\b/.test(normalizedQuery) && /\bti\b/.test(normalizedCandidate)) score += 30;
  if (/super/.test(normalizedQuery) && /super/.test(normalizedCandidate)) score += 20;
  if (/xt/.test(normalizedQuery) && /xt/.test(normalizedCandidate)) score += 20;

  return score;
}

function findBenchmarkHardwareEntry(name, entries) {
  const query = String(name || "").trim();
  if (!query) return null;

  let best = null;
  let bestScore = 0;
  for (const entry of entries || []) {
    const score = scoreBenchmarkHardwareMatch(query, entry.name);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  if (!best || bestScore < 90) return null;
  return { ...best, matchScore: bestScore };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getScenarioBaseline(game, resolution, setting) {
  return (game.baselines || []).find((baseline) => baseline.resolution === resolution && baseline.setting === setting) || null;
}

function estimateMemoryFactor(parts, dataset) {
  const reference = dataset.referenceHardware || {};
  const actualChannels = inferMemoryChannels(parts.memory);
  const actualSpeed = inferMemoryFrequency(parts.memory);
  const referenceChannels = reference.memoryChannels || 4;
  const referenceSpeed = reference.memorySpeed || 6000;
  const channelFactor = clamp(actualChannels / referenceChannels, 0.92, 1.04);
  const speedFactor = clamp(actualSpeed / referenceSpeed, 0.94, 1.04);
  return clamp(channelFactor * speedFactor, 0.91, 1.06);
}

function estimateBenchmarkRow({ game, baseline, cpuFactor, gpuFactor, memoryFactor }) {
  const cpuSensitivity = Number(game.cpuSensitivity || 0.35);
  const gpuSensitivity = 1 - cpuSensitivity;
  const blendedFactor = Math.pow(cpuFactor, cpuSensitivity) * Math.pow(gpuFactor, gpuSensitivity) * memoryFactor;
  const fps = clamp(baseline.fps * blendedFactor, 18, 900);
  const lowFactor = clamp(0.58 + (cpuSensitivity * 0.22) + ((memoryFactor - 1) * 0.2), 0.55, 0.86);
  const min1Fps = clamp(fps * lowFactor, 14, fps * 0.95);

  return {
    game: game.name,
    resolution: baseline.resolution,
    setting: baseline.setting,
    fps,
    min1Fps
  };
}

async function estimateGameBenchmarks(parts) {
  const dataset = loadLocalBenchmarkDataset();

  const cpu = inferBenchmarkCpuName(parts.cpu?.name || parts.cpu?.displayName || "");
  const gpu = inferBenchmarkGpuName(parts.gpu?.name || parts.gpu?.displayName || "");
  const cpuMatch = findBenchmarkHardwareEntry(cpu, dataset.cpus);
  const gpuMatch = findBenchmarkHardwareEntry(gpu, dataset.gpus);

  if (!cpu || !gpu || !cpuMatch || !gpuMatch) {
    return {
      configured: true,
      provider: dataset.metadata?.provider || "Local Benchmark Dataset",
      rows: [],
      message: "The local benchmark dataset could not find a close CPU or GPU match for this build yet."
    };
  }

  const reference = dataset.referenceHardware || {};
  const cpuFactor = clamp((cpuMatch.score || 1) / (reference.cpuScore || 100), 0.45, 2.6);
  const gpuFactor = clamp((gpuMatch.score || 1) / (reference.gpuScore || 100), 0.28, 3.4);
  const memoryFactor = estimateMemoryFactor(parts, dataset);
  const rows = [];
  for (const game of dataset.games || []) {
    for (const baseline of game.baselines || []) {
      if (typeof baseline.fps === "number") {
        rows.push(estimateBenchmarkRow({
          game,
          baseline,
          cpuFactor,
          gpuFactor,
          memoryFactor
        }));
      }
    }
  }

  return {
    configured: true,
    provider: dataset.metadata?.provider || "Local Benchmark Dataset",
    sourceNote: dataset.metadata?.description || "",
    matches: {
      requestedCpuName: cpu,
      requestedGpuName: gpu,
      cpuName: cpuMatch.name,
      gpuName: gpuMatch.name
    },
    rows,
    message: rows.length > 0
      ? ""
      : "The local benchmark dataset has no game rows available right now."
  };
}

function mapApiProduct(apiProduct, category) {
  const name = [apiProduct.VendorName, apiProduct.Name].filter(Boolean).join(" ");
  const displayName = buildDisplayName(apiProduct, category);
  const item = {
    id: `${category}-${apiProduct.Code || apiProduct.ProductGuid || name}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    category,
    name,
    displayName,
    brand: apiProduct.VendorName || "",
    sku: apiProduct.Code || "",
    price: formatEuro(apiProduct.PriceTax ?? apiProduct.Price),
    availability: apiProduct.DeliveryInfoText || apiProduct.DeliveryDurationText || "Check live stock on Jimms.fi",
    description: apiProduct.LongName || apiProduct.ProductGroupName || categories[category].label,
    image: apiProduct.ImageID && apiProduct.ImageBaseSrc
      ? `${apiProduct.ImageBaseSrc.replace(/^\/\//, "https://")}${apiProduct.ImageID}-ig400gg.jpg`
      : "",
    sourceUrl: apiProduct.Uri ? `${JIMMS_BASE}/fi/${apiProduct.Uri}` : `${JIMMS_BASE}${categories[category].url}`,
    productId: apiProduct.ProductID || null,
    productGuid: apiProduct.ProductGuid || null,
    productGroupName: apiProduct.ProductGroupName || "",
    productGroupFullName: (apiProduct.ProductGroupFullName || "").replace(/\|\|/g, " / ")
  };
  item.specs = deriveSpecs(item);
  return item;
}

function isBundleApiProduct(apiProduct) {
  const text = `${apiProduct.Name || ""} ${apiProduct.LongName || ""} ${apiProduct.ProductGroupName || ""}`;
  return apiProduct.ProductTypeID === 12
    || apiProduct.Flags === 2
    || /tuotepaketti|bundle|paketti/i.test(text);
}

function buildDisplayName(apiProduct, category) {
  const brand = apiProduct.VendorName || "";
  let baseName = apiProduct.Name || "";

  if (category === "cpu") {
    baseName = baseName
      .replace(/,\s*(AM[45]|LGA\s?\d{4,5}|STR5|STRX4|TR4|SP3)\b/gi, "")
      .replace(/,\s*\d+(?:[.,]\d+)?\s*GHz\b/gi, "")
      .replace(/,\s*\d{1,2}\s*-?\s*Core\b/gi, "")
      .replace(/,\s*(WOF|Boxed)\b/gi, "");
  }

  if (category === "memory") {
    baseName = baseName
      .replace(/,\s*\d+\s*(?:GB|TB)\s*(?:\([^)]*\))?/gi, "")
      .replace(/,\s*DDR[3-6]\s*\d+\s*MHz\b/gi, "")
      .replace(/,\s*CL\d+\b/gi, "")
      .replace(/,\s*\d+(?:[.,]\d+)?\s*V\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  if (category === "motherboard") {
    baseName = baseName
      .replace(/,\s*(ATX|mATX|Micro-ATX|Mini-ITX|E-ATX)-?emolevy\b/gi, "")
      .replace(/,\s*emolevy\b/gi, "");
  }

  if (category === "cooler" || category === "aio") {
    baseName = baseName
      .replace(/\s+-\s*prosessorijäähdytin\b/gi, "")
      .replace(/\s+prosessorijäähdytin\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  if (category === "gpu") {
    baseName = baseName
      .replace(/\s+-\s*Pelikoneisiin.*$/gi, "")
      .replace(/\s+-\s*näytönohjain\b/gi, "")
      .replace(/\s+näytönohjain\b/gi, "")
      .replace(/,\s*\d+\s*GB\s*GDDR\d\b/gi, "");
  }

  if (category === "storage") {
    baseName = baseName
      .replace(/,\s*(?:PCIe\s*\d(?:\.\d)?\s*)?(?:NVMe\s*)?(?:M\.2\s*2280|M\.2|2\.5[”"]?|2,5[”"]?|3\.5[”"]?|3,5[”"]?)\s*(?:SSD|HDD)?-?levy\b/gi, "")
      .replace(/\s+(?:SSD|HDD)?-?levy\b/gi, "")
      .replace(/,\s*(?:NVMe|SATA|PCIe\s*\d(?:\.\d)?(?:\s*x\d+)?|M\.2\s*2280|M\.2|2\.5[”"]?|2,5[”"]?|3\.5[”"]?|3,5[”"]?)\b/gi, "")
      .replace(/,\s*\d+\/\d+\s*MB\/s\b/gi, "");
  }

  if (category === "case") {
    baseName = baseName
      .replace(/,\s*(ikkunallinen\s*)?(miditornikotelo|mATX-kotelo|ATX-kotelo|Mini-ITX-kotelo|kotelo)\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  if (category === "psu") {
    baseName = baseName
      .replace(/^\s*\d{3,4}W\s+/i, "")
      .replace(/,\s*ATX-virtalähde\b/gi, "")
      .replace(/,\s*virtalähde\b/gi, "")
      .replace(/,\s*80\s*Plus\s*(?:Bronze|Silver|Gold|Platinum|Titanium)\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  return [brand, baseName.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()].filter(Boolean).join(" ");
}

async function fetchJsonPage(categoryKey, page) {
  const category = categories[categoryKey];
  const body = {
    Page: page,
    Items: pageSize,
    OrderBy: "6",
    OrderDir: "0",
    ProductGroup: category.group,
    FilterQuery: "",
    MinPrice: 0,
    MaxPrice: 0,
    MultivalueFilters: [
      { Name: "brand", Value: [], IsChanged: false },
      { Name: "category", Value: [], IsChanged: false }
    ]
  };

  const response = await fetch(`${JIMMS_BASE}/api/product/searchv2?${Date.now()}-${page}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "public",
      "User-Agent": "JimmsPartPicker/1.0 (+local development)",
      "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Jimms.fi returned ${response.status}`);
  }

  return response.json();
}

async function fetchCategoryFromJimms(categoryKey) {
  const firstPage = await fetchJsonPage(categoryKey, 1);
  const firstProducts = (firstPage.Products || []).filter((item) => !isBundleApiProduct(item));
  const count = firstPage.FilteredCount || firstPage.Count || firstProducts.length;
  const totalPages = Math.min(Math.ceil(count / pageSize), maxPagesPerCategory);
  const products = [...firstProducts];

  for (let page = 2; page <= totalPages; page += 1) {
    const data = await fetchJsonPage(categoryKey, page);
    products.push(...(data.Products || []).filter((item) => !isBundleApiProduct(item)));
  }

  return {
    products: uniqueProducts(products.map((item) => mapApiProduct(item, categoryKey))),
    count,
    pagesFetched: totalPages
  };
}

function filterProducts(products, query) {
  const term = query.trim().toLowerCase();
  if (!term) return products;
  return products.filter((item) =>
    `${item.name} ${item.sku} ${item.description} ${item.productGroupName || ""}`.toLowerCase().includes(term)
  );
}

async function fetchCategory(categoryKey, query) {
  const category = categories[categoryKey];
  if (!category) {
    return { source: "fallback", total: 0, products: [] };
  }

  const cached = cache.get(categoryKey);
  if (cached && Date.now() - cached.createdAt < cacheMs) {
    return {
      source: cached.source,
      total: cached.products.length,
      products: filterProducts(cached.products, query)
    };
  }

  try {
    const result = await fetchCategoryFromJimms(categoryKey);
    if (result.products.length < 1) {
      throw new Error("No products returned from Jimms.fi");
    }

    const source = `jimms.fi live, ${result.products.length} products across ${result.pagesFetched} page${result.pagesFetched === 1 ? "" : "s"}`;
    cache.set(categoryKey, { createdAt: Date.now(), products: result.products, source });
    return {
      source,
      total: result.products.length,
      products: filterProducts(result.products, query)
    };
  } catch (error) {
    const products = fallbackProducts[categoryKey] || [];
    return {
      source: `cached sample data (${error.message})`,
      total: products.length,
      products: filterProducts(products, query)
    };
  }
}

function uniqueProducts(products) {
  const seen = new Set();
  return products.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/auth/google/config") {
    if (req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        saveAppConfig({
          googleClientId: body.googleClientId || ""
        });
        const clientId = getGoogleClientId();
        sendJson(res, 200, {
          ok: true,
          enabled: Boolean(clientId),
          clientId: clientId || ""
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          message: error.message
        });
      }
      return;
    }

    const clientId = getGoogleClientId();
    sendJson(res, 200, {
      enabled: Boolean(clientId),
      clientId: clientId || ""
    });
    return;
  }

  if (url.pathname === "/api/auth/local/register" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const username = sanitizeUsername(body.username || body.name || email.split("@")[0] || "");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }
      if (username.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const store = loadUserBuildStore();
      if (store.accountsByEmail[email]) {
        sendJson(res, 409, {
          ok: false,
          message: "That email is already registered."
        });
        return;
      }
      if (store.accountsByUsername[normalizeUsername(username)]) {
        sendJson(res, 409, {
          ok: false,
          message: "That username is already taken."
        });
        return;
      }

      const userId = `local-${crypto.randomUUID()}`;
      store.users[userId] = {
        profile: {
          email,
          username,
          name: username,
          picture: "",
          authProvider: "local"
        },
        passwordHash: hashPassword(password),
        builds: []
      };
      store.accountsByEmail[email] = userId;
      store.accountsByUsername[normalizeUsername(username)] = userId;
      const token = createLocalSession(store, userId);
      let emailMessage = "Account created.";
      try {
        const welcomeEmail = buildWelcomeEmail(username, email);
        await sendEmailMessage({
          to: email,
          subject: welcomeEmail.subject,
          text: welcomeEmail.text
        });
        emailMessage = "Account created. A welcome email was sent.";
      } catch (emailError) {
        emailMessage = `Account created, but the welcome email could not be sent: ${emailError.message}`;
      }
      saveUserBuildStore(store);
      sendJson(res, 200, {
        ok: true,
        token,
        user: buildLocalUser(userId, store.users[userId]),
        message: emailMessage
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/local/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const store = loadUserBuildStore();
      const userId = store.accountsByEmail[email];
      const record = userId ? store.users[userId] : null;
      if (!record || !verifyPassword(password, record.passwordHash)) {
        sendJson(res, 401, {
          ok: false,
          message: "Email or password is incorrect."
        });
        return;
      }
      const token = createLocalSession(store, userId);
      saveUserBuildStore(store);
      sendJson(res, 200, {
        ok: true,
        token,
        user: buildLocalUser(userId, record),
        message: "Signed in."
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/local/logout" && req.method === "POST") {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+local_(.+)$/i);
    if (match) {
      const store = loadUserBuildStore();
      delete store.sessions[match[1]];
      saveUserBuildStore(store);
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/auth/local/forgot-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const store = loadUserBuildStore();
      const userId = store.accountsByEmail[email];

      if (userId && store.users[userId]) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + (1000 * 60 * 20)).toISOString();
        const resetEmail = buildResetEmail(email, code, expiresAt);
        await sendEmailMessage({
          to: email,
          subject: resetEmail.subject,
          text: resetEmail.text
        });
        store.resetTokensByEmail[email] = {
          userId,
          code,
          expiresAt
        };
        saveUserBuildStore(store);
      }

      sendJson(res, 200, {
        ok: true,
        message: "If that email exists, a password reset email has been sent."
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/local/reset-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const code = String(body.code || "").trim();
      const password = String(body.password || "");
      if (!email) {
        throw new Error("Enter your account email first.");
      }
      if (!code) {
        throw new Error("Enter the reset code from the email message.");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const store = loadUserBuildStore();
      const reset = store.resetTokensByEmail[email];
      if (!reset || reset.code !== code) {
        throw new Error("That reset code is not valid.");
      }
      if (Date.parse(reset.expiresAt) <= Date.now()) {
        delete store.resetTokensByEmail[email];
        saveUserBuildStore(store);
        throw new Error("That reset code has expired.");
      }

      const record = store.users[reset.userId];
      if (!record) {
        delete store.resetTokensByEmail[email];
        saveUserBuildStore(store);
        throw new Error("Account not found for that reset request.");
      }

      record.passwordHash = hashPassword(password);
      delete store.resetTokensByEmail[email];
      saveUserBuildStore(store);
      sendJson(res, 200, {
        ok: true,
        message: "Password updated. You can sign in now."
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/local/mailbox" && req.method === "GET") {
    try {
      const user = await getAuthenticatedUser(req);
      const store = loadUserBuildStore();
      ensureWelcomeMailboxMessage(store, user);
      saveUserBuildStore(store);
      sendJson(res, 200, {
        ok: true,
        mailbox: listMailboxMessages(store, user.email)
      });
    } catch (error) {
      sendJson(res, 401, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/local/mailbox-preview" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      if (!email) {
        throw new Error("Enter the email address first.");
      }
      const store = loadUserBuildStore();
      const userId = store.accountsByEmail[email];
      if (userId && store.users[userId]) {
        ensureWelcomeMailboxMessage(store, buildLocalUser(userId, store.users[userId]));
        saveUserBuildStore(store);
      }
      sendJson(res, 200, {
        ok: true,
        mailbox: listMailboxMessages(store, email)
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/auth/google/verify" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const user = await verifyGoogleIdToken(body.credential || "");
      sendJson(res, 200, {
        ok: true,
        user
      });
    } catch (error) {
      sendJson(res, 401, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/user/builds") {
    try {
      const user = await getAuthenticatedUser(req);
      const store = loadUserBuildStore();
      const builds = getUserBuilds(store, user);

      if (req.method === "GET") {
        builds.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        saveUserBuildStore(store);
        sendJson(res, 200, {
          ok: true,
          user,
          builds: builds.map(buildRecordSummary)
        });
        return;
      }

      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const now = new Date().toISOString();
        const name = String(body.name || "").trim() || "Untitled build";
        const parts = body.parts && typeof body.parts === "object" ? body.parts : {};
        const existing = builds.find((record) => record.id === body.id);

        if (existing) {
          existing.name = name;
          existing.parts = parts;
          existing.updatedAt = now;
          saveUserBuildStore(store);
          sendJson(res, 200, {
            ok: true,
            build: buildRecordSummary(existing)
          });
          return;
        }

        const record = {
          id: crypto.randomUUID(),
          name,
          parts,
          createdAt: now,
          updatedAt: now
        };
        builds.unshift(record);
        saveUserBuildStore(store);
        sendJson(res, 200, {
          ok: true,
          build: buildRecordSummary(record)
        });
        return;
      }

      if (req.method === "DELETE") {
        const id = url.searchParams.get("id") || "";
        const index = builds.findIndex((record) => record.id === id);
        if (index >= 0) {
          builds.splice(index, 1);
          saveUserBuildStore(store);
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 405, { ok: false, message: "Method not allowed." });
    } catch (error) {
      sendJson(res, 401, {
        ok: false,
        message: error.message
      });
    }
    return;
  }

  if (url.pathname === "/api/categories") {
    sendJson(res, 200, { categories });
    return;
  }

  if (url.pathname === "/api/products") {
    const category = url.searchParams.get("category") || "cpu";
    const query = url.searchParams.get("q") || "";
    const result = await fetchCategory(category, query);
    sendJson(res, 200, {
      category,
      categoryLabel: categories[category]?.label || category,
      source: result.source,
      total: result.total,
      products: result.products
    });
    return;
  }

  if (url.pathname === "/api/product-details") {
    const category = url.searchParams.get("category") || "";
    const sourceUrl = url.searchParams.get("url") || "";

    try {
      const details = await fetchProductDetails(category, sourceUrl);
      sendJson(res, 200, details);
    } catch (error) {
      sendJson(res, 200, {
        specs: {},
        detailSource: `unavailable (${error.message})`
      });
    }
    return;
  }

  if (url.pathname === "/api/cart-link") {
    const sourceUrl = url.searchParams.get("url") || "";
    const productId = url.searchParams.get("productId") || "";
    const productGuid = url.searchParams.get("productGuid") || "";

    try {
      const cartUrl = await resolveCartLink(sourceUrl, productId, productGuid);
      sendJson(res, 200, { cartUrl });
    } catch (error) {
      sendJson(res, 200, { cartUrl: null, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/game-benchmarks") {
    try {
      const body = req.method === "POST" ? await readJsonBody(req) : {};
      const result = await estimateGameBenchmarks(body.parts || {});
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 200, {
        configured: true,
        provider: "Local Benchmark Dataset",
        rows: [],
        message: error.message
      });
    }
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Jimms Part Picker running at http://localhost:${PORT}`);
});
