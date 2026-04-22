const categories = [
  ["cpu", "CPU"],
  ["cooling", "CPU Cooling"],
  ["gpu", "GPU"],
  ["motherboard", "Motherboard"],
  ["memory", "Memory"],
  ["storage", "Storage"],
  ["case", "Case"],
  ["psu", "PSU"]
];

const jimmsUrls = {
  cpu: "https://www.jimms.fi/fi/Product/List/000-00R",
  cooling: "https://www.jimms.fi/fi/Product/List/000-059",
  cooler: "https://www.jimms.fi/fi/Product/List/000-059",
  aio: "https://www.jimms.fi/fi/Product/List/000-1KG",
  gpu: "https://www.jimms.fi/fi/Product/List/000-00P",
  motherboard: "https://www.jimms.fi/fi/Product/List/000-00H",
  memory: "https://www.jimms.fi/fi/Product/List/000-00N",
  storage: "https://www.jimms.fi/fi/Product/List/000-00K",
  case: "https://www.jimms.fi/fi/Product/List/000-00J",
  psu: "https://www.jimms.fi/fi/Product/List/000-00U"
};

const state = {
  activeCategory: "cpu",
  activeProductCategory: "cpu",
  selected: Object.fromEntries(categories.map(([key]) => [key, null])),
  products: [],
  displayedProducts: []
};

const partList = document.querySelector("#partList");
const categoryTabs = document.querySelector("#categoryTabs");
const productsEl = document.querySelector("#products");
const productTemplate = document.querySelector("#productTemplate");
const partRowTemplate = document.querySelector("#partRowTemplate");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const brandFilter = document.querySelector("#brandFilter");
const specFilter = document.querySelector("#specFilter");
const minPriceFilter = document.querySelector("#minPriceFilter");
const maxPriceFilter = document.querySelector("#maxPriceFilter");
const stockFilter = document.querySelector("#stockFilter");
const totalPrice = document.querySelector("#totalPrice");
const catalogTitle = document.querySelector("#catalogTitle");
const catalogMeta = document.querySelector("#catalogMeta");
const sourcePill = document.querySelector("#sourcePill");
const jimmsLink = document.querySelector("#jimmsLink");
const clearBuild = document.querySelector("#clearBuild");
const compatibilityPanel = document.querySelector("#compatibilityPanel");
const compatibilityBadge = document.querySelector("#compatibilityBadge");
const compatibilityTitle = document.querySelector("#compatibilityTitle");
const compatibilityList = document.querySelector("#compatibilityList");

function parseEuro(price) {
  const normalized = String(price)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number.parseFloat(normalized) || 0;
}

function formatEuro(value) {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR"
  }).format(value).replace(/\u00a0/g, " ");
}

function categoryLabel(key) {
  return categories.find(([id]) => id === key)?.[1] || key;
}

function productCategoryLabel(key) {
  if (key === "cooler") return "Air Coolers";
  if (key === "aio") return "AIO Coolers";
  return categoryLabel(key);
}

function selectableCategoryForProduct(productCategory) {
  return productCategory === "cooler" || productCategory === "aio" ? "cooling" : productCategory;
}

function productCategoriesForTab(key) {
  return key === "cooling" ? ["cooler", "aio"] : [key];
}

function resetFilters() {
  sortSelect.value = "featured";
  brandFilter.value = "";
  specFilter.value = "";
  minPriceFilter.value = "";
  maxPriceFilter.value = "";
  stockFilter.checked = false;
}

function renderTabs() {
  categoryTabs.innerHTML = "";
  categories.forEach(([key, label]) => {
    const button = document.createElement("button");
    button.className = "tab-button";
    button.type = "button";
    button.role = "tab";
    button.textContent = label;
    button.setAttribute("aria-selected", String(key === state.activeCategory));
    button.addEventListener("click", () => {
      state.activeCategory = key;
      state.activeProductCategory = productCategoriesForTab(key)[0];
      searchInput.value = "";
      resetFilters();
      renderTabs();
      renderPartRows();
      loadProducts();
    });
    categoryTabs.append(button);
  });
}

function renderPartRows() {
  partList.innerHTML = "";
  categories.forEach(([key, label]) => {
    const row = partRowTemplate.content.firstElementChild.cloneNode(true);
    const select = row.querySelector(".part-select");
    const selected = row.querySelector(".selected-part");
    const price = row.querySelector(".part-price");
    const remove = row.querySelector(".remove-button");
    const item = state.selected[key];

    select.textContent = label;
    select.classList.toggle("active", key === state.activeCategory);
    select.addEventListener("click", () => {
      state.activeCategory = key;
      state.activeProductCategory = productCategoriesForTab(key)[0];
      renderTabs();
      renderPartRows();
      loadProducts();
    });

    if (item) {
      selected.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.sku || item.description || "Jimms.fi")}</span>`;
      price.textContent = item.price;
      remove.hidden = false;
      remove.addEventListener("click", () => {
        state.selected[key] = null;
        renderPartRows();
        updateTotal();
      });
    } else {
      selected.textContent = "No part selected";
      price.textContent = "";
      remove.hidden = true;
    }

    partList.append(row);
  });
  updateTotal();
  updateCompatibility();
}

function renderProducts() {
  productsEl.innerHTML = "";

  if (state.displayedProducts.length === 0) {
    productsEl.innerHTML = `<div class="empty">No Jimms.fi products matched that search.</div>`;
    return;
  }

  state.displayedProducts.forEach((product) => {
    const card = productTemplate.content.firstElementChild.cloneNode(true);
    const visual = card.querySelector(".product-visual");
    card.querySelector("h3").textContent = product.name;
    card.querySelector(".sku").textContent = product.sku || "Jimms.fi product";
    card.querySelector(".desc").textContent = product.description || categoryLabel(product.category);
    card.querySelector(".stock").textContent = product.availability || "Availability on Jimms.fi";
    card.querySelector(".price").textContent = product.price;
    if (product.image) {
      visual.classList.add("has-image");
      visual.innerHTML = `<img src="${escapeHtml(product.image)}" alt="">`;
    }
    renderSpecTags(card, product);
    card.querySelector("button").addEventListener("click", () => {
      state.selected[selectableCategoryForProduct(product.category)] = product;
      renderPartRows();
    });
    productsEl.append(card);
  });
}

function setLoading() {
  productsEl.innerHTML = `<div class="loading">Loading ${categoryLabel(state.activeCategory)} from Jimms.fi...</div>`;
}

async function loadProducts() {
  setLoading();
  const query = searchInput.value.trim();
  const label = categoryLabel(state.activeCategory);
  catalogTitle.textContent = label;
  jimmsLink.href = jimmsUrls[state.activeProductCategory] || jimmsUrls[state.activeCategory];

  try {
    const productCategories = productCategoriesForTab(state.activeCategory);
    const responses = await Promise.all(productCategories.map(async (category) => {
      const response = await fetch(`/api/products?category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      return response.json();
    }));
    state.products = responses.flatMap((data) => data.products || []);
    populateFilterOptions();
    applyProductFilters();
    const total = responses.reduce((sum, data) => sum + (data.total || data.products?.length || 0), 0);
    updateCatalogMeta(total, label);
    sourcePill.textContent = responses.length > 1
      ? responses.map((data) => `${data.categoryLabel}: ${data.total}`).join(" | ")
      : responses[0]?.source || "Jimms.fi";
    renderProducts();
  } catch (error) {
    state.products = [];
    state.displayedProducts = [];
    sourcePill.textContent = "Jimms.fi source unavailable";
    catalogMeta.textContent = error.message;
    renderProducts();
  }
}

function updateCatalogMeta(total, label) {
  const detail = state.activeCategory === "cooling" ? "air + AIO" : label.toLowerCase();
  catalogMeta.textContent = `${state.displayedProducts.length} shown from ${total} ${detail} products`;
}

function getSpecValues(product) {
  const specs = product.specs || {};
  const values = [];
  if (specs.socket) values.push(specs.socket);
  if (specs.memoryType) values.push(specs.memoryType);
  if (specs.formFactor) values.push(specs.formFactor);
  if (specs.coolerType) values.push(specs.coolerType);
  if (specs.radiatorSize) values.push(`${specs.radiatorSize}mm`);
  if (specs.wattage) values.push(`${specs.wattage}W`);
  if (Array.isArray(specs.supportedFormFactors)) values.push(...specs.supportedFormFactors);
  return [...new Set(values.filter(Boolean))];
}

function populateFilterOptions() {
  const currentBrand = brandFilter.value;
  const currentSpec = specFilter.value;
  const brands = [...new Set(state.products.map((item) => item.brand || item.name.split(/\s+/)[0]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const specs = [...new Set(state.products.flatMap(getSpecValues))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  brandFilter.innerHTML = `<option value="">All brands</option>`;
  brands.forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    brandFilter.append(option);
  });

  specFilter.innerHTML = `<option value="">All specs</option>`;
  specs.forEach((spec) => {
    const option = document.createElement("option");
    option.value = spec;
    option.textContent = spec;
    specFilter.append(option);
  });

  if (brands.includes(currentBrand)) brandFilter.value = currentBrand;
  if (specs.includes(currentSpec)) specFilter.value = currentSpec;
}

function applyProductFilters() {
  const brand = brandFilter.value;
  const spec = specFilter.value;
  const min = Number.parseFloat(minPriceFilter.value);
  const max = Number.parseFloat(maxPriceFilter.value);
  const inStockOnly = stockFilter.checked;

  let products = [...state.products];

  if (brand) {
    products = products.filter((item) => (item.brand || item.name.split(/\s+/)[0]) === brand);
  }

  if (spec) {
    products = products.filter((item) => getSpecValues(item).includes(spec));
  }

  if (Number.isFinite(min)) {
    products = products.filter((item) => parseEuro(item.price) >= min);
  }

  if (Number.isFinite(max)) {
    products = products.filter((item) => parseEuro(item.price) <= max);
  }

  if (inStockOnly) {
    products = products.filter((item) => /varastossa/i.test(item.availability || ""));
  }

  products.sort((a, b) => {
    switch (sortSelect.value) {
      case "price-asc":
        return parseEuro(a.price) - parseEuro(b.price);
      case "price-desc":
        return parseEuro(b.price) - parseEuro(a.price);
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  state.displayedProducts = products;
}

function refreshFilteredProducts() {
  applyProductFilters();
  updateCatalogMeta(state.products.length, categoryLabel(state.activeCategory));
  renderProducts();
}

function updateTotal() {
  const total = Object.values(state.selected).reduce((sum, item) => {
    return sum + (item ? parseEuro(item.price) : 0);
  }, 0);
  totalPrice.textContent = formatEuro(total);
}

function renderSpecTags(card, product) {
  const specs = product.specs || {};
  const tags = [];

  if (specs.socket) tags.push(specs.socket);
  if (specs.memoryType) tags.push(specs.memoryType);
  if (specs.formFactor) tags.push(specs.formFactor);
  if (specs.wattage) tags.push(`${specs.wattage}W`);
  if (specs.estimatedWatts) tags.push(`~${specs.estimatedWatts}W`);
  if (specs.coolerType) tags.push(specs.coolerType);
  if (specs.radiatorSize) tags.push(`${specs.radiatorSize}mm`);
  if (Array.isArray(specs.supportedFormFactors) && specs.supportedFormFactors.length > 0) {
    tags.push(specs.supportedFormFactors.join("/"));
  }

  if (tags.length === 0) return;

  const tagWrap = document.createElement("div");
  tagWrap.className = "spec-tags";
  tags.slice(0, 4).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tagWrap.append(chip);
  });
  card.querySelector(".product-copy").append(tagWrap);
}

function estimateBuildWatts(parts) {
  const cpuWatts = parts.cpu?.specs?.estimatedWatts || 0;
  const gpuWatts = parts.gpu?.specs?.estimatedWatts || 0;
  const storageWatts = parts.storage ? 8 : 0;
  const memoryWatts = parts.memory ? 8 : 0;
  const boardWatts = parts.motherboard ? 55 : 0;
  const overheadWatts = parts.cpu || parts.gpu || parts.motherboard ? 65 : 0;
  return cpuWatts + gpuWatts + storageWatts + memoryWatts + boardWatts + overheadWatts;
}

function addCheck(checks, type, text) {
  checks.push({ type, text });
}

function updateCompatibility() {
  const parts = state.selected;
  const checks = [];

  if (!Object.values(parts).some(Boolean)) {
    addCheck(checks, "info", "Choose parts to start checking sockets, memory type, case fit, and PSU headroom.");
  }

  if (parts.cpu && parts.motherboard) {
    const cpuSocket = parts.cpu.specs?.socket;
    const boardSocket = parts.motherboard.specs?.socket;
    if (cpuSocket && boardSocket) {
      if (cpuSocket === boardSocket) {
        addCheck(checks, "ok", `CPU socket ${cpuSocket} matches the motherboard.`);
      } else {
        addCheck(checks, "error", `CPU socket ${cpuSocket} does not match motherboard socket ${boardSocket}.`);
      }
    } else {
      addCheck(checks, "warn", "Could not read CPU or motherboard socket from the Jimms listing.");
    }
  }

  if (parts.memory && parts.motherboard) {
    const memoryType = parts.memory.specs?.memoryType;
    const boardMemoryType = parts.motherboard.specs?.memoryType;
    if (memoryType && boardMemoryType) {
      if (memoryType === boardMemoryType) {
        addCheck(checks, "ok", `${memoryType} memory matches the motherboard.`);
      } else {
        addCheck(checks, "error", `${memoryType} memory does not match ${boardMemoryType} motherboard support.`);
      }
    } else {
      addCheck(checks, "warn", "Could not read memory type for the RAM or motherboard.");
    }
  }

  if (parts.cpu && parts.cooling) {
    const cooler = parts.cooling;
    const coolerType = cooler.specs?.coolerType || "cooler";
    const cpuWatts = parts.cpu.specs?.estimatedWatts || 0;
    const radiator = cooler.specs?.radiatorSize || 0;

    if (coolerType === "AIO" && radiator > 0) {
      if (cpuWatts >= 170 && radiator < 280) {
        addCheck(checks, "warn", `A high-power CPU is paired with a ${radiator}mm AIO. Consider 280mm or larger.`);
      } else {
        addCheck(checks, "ok", `${radiator}mm AIO is a reasonable cooler class for the selected CPU.`);
      }
    } else if (cpuWatts >= 170) {
      addCheck(checks, "warn", "High-power CPU selected. Confirm the air cooler's socket support and heat rating on Jimms.fi.");
    } else {
      addCheck(checks, "info", "CPU cooler socket support is not always listed in category data. Confirm socket support on the Jimms product page.");
    }
  }

  if (parts.case && parts.motherboard) {
    const boardForm = parts.motherboard.specs?.formFactor;
    const supported = parts.case.specs?.supportedFormFactors || [];
    if (boardForm && supported.length > 0) {
      if (supported.includes(boardForm)) {
        addCheck(checks, "ok", `${boardForm} motherboard should fit the selected case.`);
      } else {
        addCheck(checks, "error", `${boardForm} motherboard may not fit this case. Case listing suggests: ${supported.join(", ")}.`);
      }
    } else {
      addCheck(checks, "warn", "Case or motherboard form factor could not be confidently read from the listings.");
    }
  }

  if (parts.case && parts.cooling?.specs?.radiatorSize) {
    addCheck(checks, "info", `Confirm the case has clearance for a ${parts.cooling.specs.radiatorSize}mm radiator.`);
  }

  if (parts.psu) {
    const estimated = estimateBuildWatts(parts);
    const psuWatts = parts.psu.specs?.wattage;
    if (psuWatts && estimated > 0) {
      const recommended = Math.ceil(estimated * 1.3 / 50) * 50;
      if (psuWatts < estimated) {
        addCheck(checks, "error", `Estimated load is about ${estimated}W, above the selected ${psuWatts}W PSU.`);
      } else if (psuWatts < recommended) {
        addCheck(checks, "warn", `Estimated load is about ${estimated}W. A ${recommended}W PSU gives healthier headroom than ${psuWatts}W.`);
      } else {
        addCheck(checks, "ok", `${psuWatts}W PSU has headroom for the estimated ${estimated}W load.`);
      }
    } else if (Object.values(parts).some(Boolean)) {
      addCheck(checks, "warn", "Could not estimate PSU headroom from the selected listings.");
    }
  } else if (parts.cpu || parts.gpu || parts.motherboard) {
    addCheck(checks, "info", "Add a PSU to check estimated wattage headroom.");
  }

  if (parts.storage && parts.motherboard && /M\.2|NVMe/i.test(parts.storage.name + " " + parts.storage.description)) {
    addCheck(checks, "info", "M.2/NVMe storage support depends on motherboard slot details. Open the Jimms motherboard page to confirm slots.");
  }

  renderCompatibility(checks);
}

function renderCompatibility(checks) {
  compatibilityList.innerHTML = "";

  const hasError = checks.some((check) => check.type === "error");
  const hasWarn = checks.some((check) => check.type === "warn");
  const okCount = checks.filter((check) => check.type === "ok").length;

  compatibilityPanel.dataset.status = hasError ? "error" : hasWarn ? "warn" : "ok";
  compatibilityBadge.textContent = hasError ? "Issues" : hasWarn ? "Check" : "OK";
  compatibilityTitle.textContent = hasError
    ? "Compatibility Issues Found"
    : hasWarn
      ? "Compatibility Needs Review"
      : okCount > 0
        ? "Compatibility Looks Good"
        : "Compatibility Check";

  checks.forEach((check) => {
    const item = document.createElement("li");
    item.className = `compat-${check.type}`;
    item.textContent = check.text;
    compatibilityList.append(item);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 280);
});

[sortSelect, brandFilter, specFilter, minPriceFilter, maxPriceFilter, stockFilter].forEach((control) => {
  control.addEventListener("input", refreshFilteredProducts);
  control.addEventListener("change", refreshFilteredProducts);
});

clearBuild.addEventListener("click", () => {
  Object.keys(state.selected).forEach((key) => {
    state.selected[key] = null;
  });
  renderPartRows();
});

renderTabs();
renderPartRows();
loadProducts();
