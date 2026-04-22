const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, "public");
const JIMMS_BASE = "https://www.jimms.fi";

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
const cacheMs = 1000 * 60 * 12;
const pageSize = 100;
const maxPagesPerCategory = 30;

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
    sourceUrl: `${JIMMS_BASE}${categories[category]?.url || "/fi/Product/Komponentit"}`
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

function formatEuro(value) {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0).replace(/\u00a0/g, " ");
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

function detectRadiatorSize(text) {
  const match = text.match(/\b(120|140|240|280|360|420)\s*mm\b/i);
  return match ? Number(match[1]) : null;
}

function detectCoolerType(text, category) {
  if (category === "aio" || /\b(AIO|nestejäähdytys|vesijäähdytys|liquid)\b/i.test(text)) return "AIO";
  return "Air";
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

function deriveSpecs(item) {
  const text = `${item.name || ""} ${item.description || ""} ${item.productGroupName || ""} ${item.productGroupFullName || ""}`;
  const specs = {};

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
  }

  if (item.category === "gpu") {
    specs.memoryType = /GDDR\d/i.test(text) ? firstMatch(text, /\b(GDDR\d)\b/i).toUpperCase() : null;
    specs.estimatedWatts = estimateGpuWatts(text);
  }

  if (item.category === "motherboard") {
    specs.socket = detectSocket(text);
    specs.memoryType = detectMemoryType(text);
    specs.formFactor = detectMotherboardFormFactor(text);
  }

  if (item.category === "memory") {
    specs.memoryType = detectMemoryType(text);
    specs.capacityGb = Number(firstMatch(text, /\b(\d{1,4})GB\b/i)) || null;
  }

  if (item.category === "case") {
    specs.supportedFormFactors = detectCaseFormFactors(text);
  }

  if (item.category === "psu") {
    specs.wattage = detectPsuWattage(text);
  }

  return specs;
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
    productGroupName: apiProduct.ProductGroupName || "",
    productGroupFullName: (apiProduct.ProductGroupFullName || "").replace(/\|\|/g, " / ")
  };
  item.specs = deriveSpecs(item);
  return item;
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
      .replace(/,\s*DDR[3-6]\s*\d+\s*MHz\b/gi, "")
      .replace(/,\s*CL\d+\b/gi, "");
  }

  if (category === "motherboard") {
    baseName = baseName.replace(/,\s*(ATX|mATX|Micro-ATX|Mini-ITX|E-ATX)-?emolevy\b/gi, "");
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
  const firstProducts = firstPage.Products || [];
  const count = firstPage.FilteredCount || firstPage.Count || firstProducts.length;
  const totalPages = Math.min(Math.ceil(count / pageSize), maxPagesPerCategory);
  const products = [...firstProducts];

  for (let page = 2; page <= totalPages; page += 1) {
    const data = await fetchJsonPage(categoryKey, page);
    products.push(...(data.Products || []));
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
