const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, "public");
const JIMMS_BASE = "https://www.jimms.fi";

const categories = {
  cpu: { label: "CPU", url: "/fi/Product/List/000-00R" },
  gpu: { label: "Graphics Card", url: "/fi/Product/List/000-00P" },
  motherboard: { label: "Motherboard", url: "/fi/Product/List/000-00H" },
  memory: { label: "Memory", url: "/fi/Product/List/000-00N" },
  storage: { label: "Storage", url: "/fi/Product/List/000-00K" },
  case: { label: "Case", url: "/fi/Product/List/000-00J" },
  psu: { label: "Power Supply", url: "/fi/Product/List/000-00U" }
};

const cache = new Map();
const cacheMs = 1000 * 60 * 12;

const fallbackProducts = {
  cpu: [
    product("cpu", "AMD Ryzen 7 9800X3D, AM5, 4.7 GHz, 8-Core, WOF", "100-100001084WOF", "509,90 €", "Varastossa", "AMD AM5, 8-Core, gaming CPU"),
    product("cpu", "AMD Ryzen 5 9600X, AM5, 3.9 GHz, 6-Core, WOF", "100-100001405WOF", "224,90 €", "Varastossa", "AM5, 6-Core"),
    product("cpu", "Intel Core i5-14600K, LGA1700, 3.50 GHz, 24MB, Boxed", "BX8071514600K", "251,90 €", "Varastossa", "LGA1700, unlocked")
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
  return {
    id: `${category}-${sku}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    category,
    name,
    sku,
    price,
    availability,
    description,
    sourceUrl: `${JIMMS_BASE}${categories[category]?.url || "/fi/Product/Komponentit"}`
  };
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
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

function parseJimmsProducts(html, category) {
  const cardBlocks = html.split(/\sdata-productguid=/i).slice(1);
  const cardProducts = cardBlocks.map((block) => {
    const nameMatch = block.match(/<h5 class="product-box-name">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const skuMatch = block.match(/<div class="product-box-sku">([\s\S]*?)<\/div>/i);
    const descriptionMatch = block.match(/<div class="product-list-rows--visible product-box-short-description">([\s\S]*?)<\/div>/i);
    const priceMatch = block.match(/<span class="price__amount">([\s\S]*?)<\/span>/i);
    const hrefMatch = block.match(/<a class="[^"]*js-gtm-product-link[^"]*" href="([^"]+)"/i);
    const imageMatch = block.match(/data-src="([^"]+)"/i);

    if (!nameMatch || !priceMatch) return null;

    const name = stripHtml(nameMatch[1]).join(" ");
    const sku = skuMatch ? stripHtml(skuMatch[1]).join(" ") : "";
    const description = descriptionMatch ? stripHtml(descriptionMatch[1]).join(" ") : categories[category].label;
    const href = hrefMatch ? hrefMatch[1] : categories[category].url;
    const image = imageMatch ? imageMatch[1].replace(/^\/\//, "https://") : "";

    return {
      id: `${category}-${sku || name}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      category,
      name,
      sku,
      price: stripHtml(priceMatch[1]).join(" "),
      availability: "Check live stock on Jimms.fi",
      description,
      image,
      sourceUrl: href.startsWith("http") ? href : `${JIMMS_BASE}${href}`
    };
  }).filter(Boolean);

  if (cardProducts.length > 0) {
    return uniqueProducts(cardProducts);
  }

  const lines = stripHtml(html);
  const products = [];
  const pricePattern = /^\d[\d\s.,]*,\d{2}\s*€(?:\s+\d[\d\s.,]*,\d{2}\s*€)?$/;
  const ignored = new Set(["sort", "filter_list Suodata", "apps grid_view table_rows", "Haetaan tuotteita...", "add_shopping_cart Lisää koriin", "Näytä tuote"]);

  for (let i = 0; i < lines.length; i += 1) {
    const name = lines[i];
    if (
      ignored.has(name) ||
      name.length < 12 ||
      pricePattern.test(name) ||
      /^fiber_manual_record/.test(name) ||
      /^star\b/.test(name)
    ) {
      continue;
    }

    let priceIndex = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
      if (pricePattern.test(lines[j])) {
        priceIndex = j;
        break;
      }
    }

    if (priceIndex === -1) continue;

    const sku = lines[i + 1] && !ignored.has(lines[i + 1]) ? lines[i + 1] : "";
    const details = lines
      .slice(i + 2, priceIndex)
      .filter((line) => !/^star\b/.test(line) && !/^local_offer/.test(line))
      .slice(0, 2)
      .join(" | ");
    const availability =
      lines.slice(priceIndex + 1, priceIndex + 5).find((line) => /^fiber_manual_record/.test(line)) || "Saatavuus Jimms.fi";

    products.push({
      id: `${category}-${sku || name}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      category,
      name,
      sku,
      price: lines[priceIndex].split("€")[0].trim() + " €",
      availability: availability.replace("fiber_manual_record", "").trim(),
      description: details || categories[category].label,
      sourceUrl: `${JIMMS_BASE}${categories[category].url}`
    });

    i = priceIndex;
  }

  return uniqueProducts(products);
}

function uniqueProducts(products) {
  const seen = new Set();
  return products.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function filterProducts(products, query) {
  const term = query.trim().toLowerCase();
  if (!term) return products;
  return products.filter((item) =>
    `${item.name} ${item.sku} ${item.description}`.toLowerCase().includes(term)
  );
}

async function fetchCategory(categoryKey, query) {
  const category = categories[categoryKey];
  if (!category) {
    return { source: "fallback", products: [] };
  }

  const cacheKey = categoryKey;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < cacheMs) {
    return { source: cached.source, products: filterProducts(cached.products, query) };
  }

  try {
    const response = await fetch(`${JIMMS_BASE}${category.url}`, {
      headers: {
        "User-Agent": "JimmsPartPicker/1.0 (+local development)",
        "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`Jimms.fi returned ${response.status}`);
    }

    const html = await response.text();
    const parsed = parseJimmsProducts(html, categoryKey);
    if (parsed.length < 1) {
      throw new Error("No products parsed from Jimms.fi");
    }

    cache.set(cacheKey, { createdAt: Date.now(), products: parsed, source: "jimms.fi live" });
    return { source: "jimms.fi live", products: filterProducts(parsed, query) };
  } catch (error) {
    const products = fallbackProducts[categoryKey] || [];
    return {
      source: `cached sample data (${error.message})`,
      products: filterProducts(products, query)
    };
  }
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
