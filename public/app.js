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

const THEME_KEY = "jimms-part-picker-theme";
const DRAFT_KEY = "jimms-part-picker-current-build";
const AUTH_TOKEN_KEY = "jimms-part-picker-auth-token";
const LOCAL_SAVED_BUILDS_KEY = "jimms-part-picker-local-saved-builds";

const state = {
  activeCategory: "cpu",
  activeProductCategory: "cpu",
  selected: Object.fromEntries(categories.map(([key]) => [key, null])),
  products: [],
  displayedProducts: [],
  currentBuildId: null,
  currentBuildName: "My Build",
  savedBuilds: [],
  auth: {
    token: window.localStorage.getItem(AUTH_TOKEN_KEY) || "",
    user: null
  },
  benchmarks: {
    status: "idle",
    key: "",
    note: "Complete the build to load benchmark estimates.",
    rows: []
  }
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
const addToJimmsCart = document.querySelector("#addToJimmsCart");
const compatibilityPanel = document.querySelector("#compatibilityPanel");
const compatibilityBadge = document.querySelector("#compatibilityBadge");
const compatibilityTitle = document.querySelector("#compatibilityTitle");
const compatibilityList = document.querySelector("#compatibilityList");
const benchmarkPanel = document.querySelector("#benchmarkPanel");
const benchmarkNote = document.querySelector("#benchmarkNote");
const benchmarkList = document.querySelector("#benchmarkList");
const themeToggle = document.querySelector("#themeToggle");
const authSummary = document.querySelector("#authSummary");
const authInlineStatus = document.querySelector("#authInlineStatus");
const authLaunchers = document.querySelector("#authLaunchers");
const signOutButton = document.querySelector("#signOutButton");
const authScreen = document.querySelector("#authScreen");
const authBackdrop = document.querySelector("#authBackdrop");
const closeAuthScreenButton = document.querySelector("#closeAuthScreenButton");
const authPageTitle = document.querySelector("#authPageTitle");
const authPageMeta = document.querySelector("#authPageMeta");
const savedBuildsStatus = document.querySelector("#savedBuildsStatus");
const buildNameInput = document.querySelector("#buildNameInput");
const saveBuildButton = document.querySelector("#saveBuildButton");
const newBuildButton = document.querySelector("#newBuildButton");
const savedBuildsList = document.querySelector("#savedBuildsList");
const registerButton = document.querySelector("#registerButton");
const loginButton = document.querySelector("#loginButton");
const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const testEmailButton = document.querySelector("#testEmailButton");
const registerPage = document.querySelector("#registerPage");
const loginPage = document.querySelector("#loginPage");
const forgotPage = document.querySelector("#forgotPage");
const registerUsernameInput = document.querySelector("#registerUsernameInput");
const registerEmailInput = document.querySelector("#registerEmailInput");
const registerPasswordInput = document.querySelector("#registerPasswordInput");
const registerConfirmPasswordInput = document.querySelector("#registerConfirmPasswordInput");
const loginEmailInput = document.querySelector("#loginEmailInput");
const loginPasswordInput = document.querySelector("#loginPasswordInput");
const forgotEmailInput = document.querySelector("#forgotEmailInput");
const switchToLoginButton = document.querySelector("#switchToLoginButton");
const switchToForgotButton = document.querySelector("#switchToForgotButton");
const requestResetButton = document.querySelector("#requestResetButton");
const sendTestEmailButton = document.querySelector("#sendTestEmailButton");
const resetCodeInput = document.querySelector("#resetCodeInput");
const resetPasswordInput = document.querySelector("#resetPasswordInput");
const resetConfirmPasswordInput = document.querySelector("#resetConfirmPasswordInput");
const resetPasswordButton = document.querySelector("#resetPasswordButton");

const authPageConfig = {
  register: {
    title: "Create Account",
    meta: "Set up a username, email, and password for saved builds.",
    page: registerPage
  },
  login: {
    title: "Sign In",
    meta: "Sign in to save and load named builds from your account.",
    page: loginPage
  },
  forgot: {
    title: "Forgot Password",
    meta: "Send a reset email, then enter the code and your new password here.",
    page: forgotPage
  }
};

function getStoredTheme() {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  themeToggle.textContent = nextTheme === "dark" ? "Light mode" : "Dark mode";
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = current === "dark" ? "light" : "dark";
  window.localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

function authHeaders() {
  return state.auth.token
    ? { Authorization: `Bearer ${state.auth.token}` }
    : {};
}

function cloneBuildParts(parts) {
  return JSON.parse(JSON.stringify(parts || {}));
}

function persistCurrentBuild() {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
    currentBuildId: state.currentBuildId,
    currentBuildName: state.currentBuildName,
    selected: cloneBuildParts(state.selected)
  }));
}

function loadLocalSavedBuilds() {
  try {
    const raw = window.localStorage.getItem(LOCAL_SAVED_BUILDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not load local saved builds", error);
    return [];
  }
}

function saveLocalSavedBuilds(builds) {
  window.localStorage.setItem(LOCAL_SAVED_BUILDS_KEY, JSON.stringify(builds));
}

function restoreCurrentBuild() {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state.currentBuildId = parsed.currentBuildId || null;
      state.currentBuildName = parsed.currentBuildName || "My Build";
      if (parsed.selected && typeof parsed.selected === "object") {
        const selected = cloneBuildParts(parsed.selected);
        categories.forEach(([key]) => {
          state.selected[key] = selected[key] || null;
        });
      }
    }
  } catch (error) {
    console.warn("Could not restore current build draft", error);
  }
}

function resetCurrentBuild(clearParts = true) {
  state.currentBuildId = null;
  state.currentBuildName = "My Build";
  if (clearParts) {
    Object.keys(state.selected).forEach((key) => {
      state.selected[key] = null;
    });
  }
  buildNameInput.value = state.currentBuildName;
  persistCurrentBuild();
}

function updateBuildNameInput() {
  if (buildNameInput.value !== state.currentBuildName) {
    buildNameInput.value = state.currentBuildName;
  }
}

function partCount(parts) {
  return categories.filter(([key]) => Boolean(parts?.[key])).length;
}

function formatSavedBuildTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fi-FI", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderSavedBuilds() {
  savedBuildsList.innerHTML = "";

  if (!state.auth.user) {
    savedBuildsStatus.textContent = "Save builds locally now, or sign in to keep named builds in your account.";
    saveBuildButton.disabled = false;
    savedBuildButtonLabel();
  }

  if (state.auth.user) {
    savedBuildsStatus.textContent = `${state.auth.user.username || state.auth.user.name} can save as many named builds as needed.`;
    saveBuildButton.disabled = false;
    savedBuildButtonLabel();
  }

  if (state.savedBuilds.length === 0) {
    savedBuildsList.innerHTML = `<div class="empty">${state.auth.user ? "No saved builds yet for this account." : "No local saved builds yet on this device."}</div>`;
    return;
  }

  state.savedBuilds.forEach((build) => {
    const row = document.createElement("article");
    row.className = "saved-build-row";

    const copy = document.createElement("div");
    copy.className = "saved-build-copy";
    const name = document.createElement("strong");
    name.textContent = build.name;
    const meta = document.createElement("span");
    meta.textContent = `${partCount(build.parts)} parts · updated ${formatSavedBuildTime(build.updatedAt)}`;
    copy.append(name, meta);

    const loadButton = document.createElement("button");
    loadButton.className = "ghost-button";
    loadButton.type = "button";
    loadButton.textContent = "Load";
    loadButton.addEventListener("click", () => {
      state.currentBuildId = build.id;
      state.currentBuildName = build.name || "My Build";
      const parts = cloneBuildParts(build.parts);
      categories.forEach(([key]) => {
        state.selected[key] = parts[key] || null;
      });
      persistCurrentBuild();
      updateBuildNameInput();
      renderPartRows();
      renderSavedBuilds();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      try {
        if (state.auth.user) {
          const response = await fetch(`/api/user/builds?id=${encodeURIComponent(build.id)}`, {
            method: "DELETE",
            headers: {
              ...authHeaders()
            }
          });
          if (!response.ok) throw new Error("Delete failed");
          state.savedBuilds = state.savedBuilds.filter((entry) => entry.id !== build.id);
        } else {
          state.savedBuilds = state.savedBuilds.filter((entry) => entry.id !== build.id);
          saveLocalSavedBuilds(state.savedBuilds);
        }
        if (state.currentBuildId === build.id) {
          state.currentBuildId = null;
          persistCurrentBuild();
        }
        renderSavedBuilds();
      } catch (error) {
        window.alert("Could not delete that saved build right now.");
      }
    });

    row.append(copy, loadButton, deleteButton);
    savedBuildsList.append(row);
  });
}

function savedBuildButtonLabel() {
  saveBuildButton.textContent = state.currentBuildId ? "Update Saved Build" : "Save Build";
}

function setAuthStatus(message = "", tone = "") {
  authInlineStatus.textContent = message || "";
  if (tone) {
    authInlineStatus.dataset.tone = tone;
  } else {
    delete authInlineStatus.dataset.tone;
  }
}

function syncAuthEmails(email = "") {
  if (email && registerEmailInput.value.trim() !== email) registerEmailInput.value = email;
  if (email && loginEmailInput.value.trim() !== email) loginEmailInput.value = email;
  if (email && forgotEmailInput.value.trim() !== email) forgotEmailInput.value = email;
}

function openAuthView(mode) {
  const config = authPageConfig[mode] || authPageConfig.login;
  Object.values(authPageConfig).forEach((entry) => {
    entry.page.hidden = entry !== config;
  });
  authPageTitle.textContent = config.title;
  authPageMeta.textContent = config.meta;
  authScreen.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAuthView() {
  authScreen.hidden = true;
  document.body.style.overflow = "";
}

function clearResetInputs() {
  resetCodeInput.value = "";
  resetPasswordInput.value = "";
  resetConfirmPasswordInput.value = "";
}

async function fetchSavedBuilds() {
  if (!state.auth.token) {
    state.auth.user = null;
    state.savedBuilds = loadLocalSavedBuilds();
    renderSavedBuilds();
    renderAuthState();
    return;
  }

  try {
    const response = await fetch("/api/user/builds", {
      headers: {
        ...authHeaders()
      }
    });
    if (!response.ok) throw new Error("Auth expired");
    const data = await response.json();
    state.auth.user = data.user || null;
    state.savedBuilds = data.builds || [];
  } catch (error) {
    state.auth.token = "";
    state.auth.user = null;
    state.savedBuilds = loadLocalSavedBuilds();
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  renderAuthState();
  renderSavedBuilds();
}

async function saveCurrentBuild() {
  if (!state.auth.user) {
    const now = new Date().toISOString();
    const existing = state.savedBuilds.find((build) => build.id === state.currentBuildId);
    if (existing) {
      existing.name = state.currentBuildName;
      existing.parts = cloneBuildParts(state.selected);
      existing.updatedAt = now;
    } else {
      const record = {
        id: state.currentBuildId || `local-${Date.now()}`,
        name: state.currentBuildName,
        parts: cloneBuildParts(state.selected),
        createdAt: now,
        updatedAt: now
      };
      state.currentBuildId = record.id;
      state.savedBuilds.unshift(record);
    }
    saveLocalSavedBuilds(state.savedBuilds);
    persistCurrentBuild();
    renderSavedBuilds();
    return;
  }

  const response = await fetch("/api/user/builds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({
      id: state.currentBuildId,
      name: state.currentBuildName,
      parts: state.selected
    })
  });
  if (!response.ok) {
    throw new Error("Save failed");
  }

  const data = await response.json();
  if (data.build?.id) {
    state.currentBuildId = data.build.id;
  }
  await fetchSavedBuilds();
  persistCurrentBuild();
}

function renderAuthState() {
  if (state.auth.user) {
    authSummary.textContent = `${state.auth.user.username || state.auth.user.name} (${state.auth.user.email})`;
    signOutButton.hidden = false;
    authLaunchers.hidden = true;
    testEmailButton.hidden = false;
    clearResetInputs();
    return;
  }

  authSummary.textContent = "Guest mode (local saves still work)";
  signOutButton.hidden = true;
  authLaunchers.hidden = false;
  testEmailButton.hidden = true;
}

async function loadAuthConfig() {
  clearResetInputs();
  setAuthStatus("");
  renderAuthState();
  renderSavedBuilds();
  await fetchSavedBuilds();
}

async function submitLocalAuth(mode) {
  const email = mode === "register" ? registerEmailInput.value.trim() : loginEmailInput.value.trim();
  const password = mode === "register" ? registerPasswordInput.value : loginPasswordInput.value;
  if (mode === "register" && password !== registerConfirmPasswordInput.value) {
    throw new Error("Passwords do not match.");
  }
  const payload = {
    email,
    password
  };
  if (mode === "register") {
    payload.username = registerUsernameInput.value.trim();
  }

  const response = await fetch(`/api/auth/local/${mode}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Authentication failed.");
  }

  state.auth.token = data.token || "";
  state.auth.user = data.user || null;
  window.localStorage.setItem(AUTH_TOKEN_KEY, state.auth.token);
  registerPasswordInput.value = "";
  registerConfirmPasswordInput.value = "";
  loginPasswordInput.value = "";
  clearResetInputs();
  syncAuthEmails(email);
  setAuthStatus(data.message || (mode === "register" ? "Account created." : "Signed in."), "ok");
  renderAuthState();
  await fetchSavedBuilds();
  closeAuthView();
}

async function requestPasswordReset() {
  const email = forgotEmailInput.value.trim();
  const response = await fetch("/api/auth/local/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Could not start password reset.");
  }

  syncAuthEmails(email);
  setAuthStatus(data.message || "Reset message sent.", "ok");
}

async function submitPasswordReset() {
  const email = forgotEmailInput.value.trim();
  const code = resetCodeInput.value.trim();
  const password = resetPasswordInput.value;
  if (password !== resetConfirmPasswordInput.value) {
    throw new Error("Passwords do not match.");
  }
  const response = await fetch("/api/auth/local/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      code,
      password
    })
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Could not reset password.");
  }

  loginPasswordInput.value = "";
  resetPasswordInput.value = "";
  resetConfirmPasswordInput.value = "";
  resetCodeInput.value = "";
  syncAuthEmails(email);
  setAuthStatus(data.message || "Password updated. Sign in with the new password.", "ok");
  openAuthView("login");
}

async function sendTestEmail() {
  const email = (state.auth.user?.email || forgotEmailInput.value || loginEmailInput.value || registerEmailInput.value || "").trim();
  const response = await fetch("/api/email/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Could not send test email.");
  }
  setAuthStatus(data.message || "Test email sent.", "ok");
}

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

function selectedBuildProducts() {
  return categories
    .map(([key]) => state.selected[key])
    .filter(Boolean);
}

function hasCompleteBuild() {
  return categories.every(([key]) => Boolean(state.selected[key]));
}

function benchmarkBuildKey() {
  return categories.map(([key]) => state.selected[key]?.id || "").join("|");
}

function productsReadyForJimmsCart() {
  return selectedBuildProducts().filter((product) => product.productId && product.productGuid);
}

function formatSkippedCartProducts(products) {
  return products.map((product) => product.displayName || cleanProductName(product)).join(", ");
}

function buildJimmsAddToCartUrl(product) {
  const params = new URLSearchParams({
    ProductID: String(product.productId),
    Qty: "1",
    ProductGuid: String(product.productGuid)
  });
  return `https://www.jimms.fi/fi/ShoppingCart/AddItem?${params.toString()}`;
}

async function resolveProductCartUrl(product) {
  if (product.productId && product.productGuid) {
    return buildJimmsAddToCartUrl(product);
  }

  if (!product.sourceUrl) return null;

  const params = new URLSearchParams({
    url: product.sourceUrl
  });
  if (product.productId) params.set("productId", String(product.productId));
  if (product.productGuid) params.set("productGuid", String(product.productGuid));

  try {
    const response = await fetch(`/api/cart-link?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.cartUrl || null;
  } catch (error) {
    console.warn("Could not resolve Jimms cart link", error);
    return null;
  }
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
      selected.innerHTML = "";
      const name = document.createElement("strong");
      name.textContent = item.displayName || cleanProductName(item);
      selected.append(name);

      const details = document.createElement("div");
      details.className = "selected-details";
      const values = productDetailValues(item);
      const detailText = values.length > 0 ? values.join(" · ") : item.description || item.sku || "Jimms.fi";
      details.textContent = detailText;
      selected.append(details);

      const meta = document.createElement("span");
      meta.textContent = item.sku || item.description || "Jimms.fi";
      selected.append(meta);
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
  loadBenchmarks();
  updateBuildNameInput();
  savedBuildButtonLabel();
  persistCurrentBuild();
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
    card.querySelector("h3").textContent = product.displayName || cleanProductName(product);
    card.querySelector(".sku").textContent = product.sku || "Jimms.fi product";
    renderProductDetails(card, product);
    card.querySelector(".desc").textContent = product.specs?.valueSummary || product.description || categoryLabel(product.category);
    card.querySelector(".stock").textContent = product.availability || "Availability on Jimms.fi";
    card.querySelector(".price").textContent = product.price;
    if (product.image) {
      visual.classList.add("has-image");
      visual.innerHTML = `<img src="${escapeHtml(product.image)}" alt="">`;
    }
    renderSpecTags(card, product);
    card.querySelector("button").addEventListener("click", () => {
      const slot = selectableCategoryForProduct(product.category);
      state.selected[slot] = product;
      renderPartRows();
      enrichSelectedProduct(slot, product);
    });
    productsEl.append(card);
  });
}

async function enrichSelectedProduct(slot, product) {
  if (!["cooling", "motherboard", "case", "gpu", "psu"].includes(slot) || !product.sourceUrl) return;

  try {
    const response = await fetch(`/api/product-details?category=${encodeURIComponent(product.category)}&url=${encodeURIComponent(product.sourceUrl)}`);
    if (!response.ok) return;
    const details = await response.json();
    if (state.selected[slot]?.id !== product.id) return;

    state.selected[slot] = {
      ...state.selected[slot],
      specs: {
        ...(state.selected[slot].specs || {}),
        ...(details.specs || {})
      },
      detailSource: details.detailSource
    };
    renderPartRows();
  } catch (error) {
    console.warn("Could not load product details", error);
  }
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
  if (specs.valueLabel) values.push(specs.valueLabel);
  if (specs.thermalLabel) values.push(specs.thermalLabel);
  if (specs.targetResolution) values.push(specs.targetResolution);
  if (specs.efficiencyTier) values.push(`${capitalize(specs.efficiencyTier)} efficiency`);
  if (specs.socket) values.push(specs.socket);
  if (specs.memoryType) values.push(specs.memoryType);
  if (specs.formFactor) values.push(specs.formFactor);
  if (specs.coolerType) values.push(specs.coolerType);
  if (specs.radiatorSize) values.push(`${specs.radiatorSize}mm`);
  if (specs.coolerHeightMm) values.push(`${specs.coolerHeightMm}mm cooler height`);
  if (specs.gpuLengthMm) values.push(`${specs.gpuLengthMm}mm GPU length`);
  if (specs.psuLengthMm) values.push(`${specs.psuLengthMm}mm PSU length`);
  if (specs.maxRadiatorSize) values.push(`Up to ${specs.maxRadiatorSize}mm radiator`);
  if (specs.maxGpuLengthMm) values.push(`GPU up to ${specs.maxGpuLengthMm}mm`);
  if (specs.maxCpuCoolerHeightMm) values.push(`Cooler up to ${specs.maxCpuCoolerHeightMm}mm`);
  if (specs.maxPsuLengthMm) values.push(`PSU up to ${specs.maxPsuLengthMm}mm`);
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
      case "value-desc":
        return (b.specs?.valueScore || 0) - (a.specs?.valueScore || 0)
          || parseEuro(a.price) - parseEuro(b.price)
          || a.name.localeCompare(b.name);
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
  updateBuildActions();
}

function updateBuildActions() {
  const selected = selectedBuildProducts();
  const ready = productsReadyForJimmsCart();
  const skippedProducts = selected.filter((product) => !(product.productId && product.productGuid));
  const skipped = skippedProducts.length;

  addToJimmsCart.disabled = selected.length === 0;
  addToJimmsCart.textContent = selected.length > 0
    ? `Add ${selected.length} Part${selected.length === 1 ? "" : "s"} to Jimms Cart`
    : "Add Build to Jimms Cart";
  addToJimmsCart.title = skipped > 0
    ? `${skipped} selected part${skipped === 1 ? "" : "s"} need an extra Jimms page lookup before they can be added: ${formatSkippedCartProducts(skippedProducts)}.`
    : "Open the selected build in Jimms cart.";
}

function renderBenchmarks() {
  benchmarkList.innerHTML = "";

  if (!hasCompleteBuild()) {
    benchmarkPanel.hidden = true;
    benchmarkNote.textContent = "Complete the build to load benchmark estimates.";
    return;
  }

  benchmarkPanel.hidden = false;
  benchmarkNote.textContent = state.benchmarks.note;

  if (!state.benchmarks.rows.length) {
    return;
  }

  const grouped = new Map();
  state.benchmarks.rows.forEach((row) => {
    if (!grouped.has(row.game)) grouped.set(row.game, []);
    grouped.get(row.game).push(row);
  });

  grouped.forEach((rows, game) => {
    const card = document.createElement("article");
    card.className = "benchmark-game";
    const title = document.createElement("h3");
    title.textContent = game;
    card.append(title);

    const grid = document.createElement("div");
    grid.className = "benchmark-grid";
    rows
      .sort((a, b) => `${a.resolution} ${a.setting}`.localeCompare(`${b.resolution} ${b.setting}`))
      .forEach((row) => {
        const item = document.createElement("div");
        item.className = "benchmark-row";
        const meta = document.createElement("span");
        meta.textContent = `${row.resolution} ${row.setting}`;
        const fps = document.createElement("strong");
        fps.textContent = row.min1Fps
          ? `${Math.round(row.fps)} FPS avg / ${Math.round(row.min1Fps)} 1% low`
          : `${Math.round(row.fps)} FPS`;
        item.append(meta, fps);
        grid.append(item);
      });

    card.append(grid);
    benchmarkList.append(card);
  });
}

async function loadBenchmarks() {
  if (!hasCompleteBuild()) {
    state.benchmarks = {
      status: "idle",
      key: "",
      note: "Complete the build to load benchmark estimates.",
      rows: []
    };
    renderBenchmarks();
    return;
  }

  const key = benchmarkBuildKey();
  if (state.benchmarks.key === key && state.benchmarks.status === "ready") {
    renderBenchmarks();
    return;
  }

  state.benchmarks = {
    status: "loading",
    key,
    note: "Loading local game FPS estimates...",
    rows: []
  };
  renderBenchmarks();

  try {
    const response = await fetch("/api/game-benchmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ parts: state.selected })
    });
    const data = await response.json();
    if (benchmarkBuildKey() !== key) return;

    state.benchmarks = {
      status: "ready",
      key,
      note: data.configured
        ? (data.rows?.length
          ? [
            data.sourceNote || `Estimated FPS from ${data.provider || "Local Benchmark Dataset"}.`,
            data.matches?.cpuName && data.matches?.gpuName
              ? `Matched to ${data.matches.cpuName} + ${data.matches.gpuName}.`
              : ""
          ].filter(Boolean).join(" ")
          : data.message || `${data.provider || "Local Benchmark Dataset"} returned no FPS rows for the current build.`)
        : `${data.provider || "Local Benchmark Dataset"} is not available right now.`,
      rows: data.rows || []
    };
  } catch (error) {
    state.benchmarks = {
      status: "error",
      key,
      note: "Could not load game FPS estimates right now.",
      rows: []
    };
  }

  renderBenchmarks();
}

async function openBuildInJimmsCart() {
  const selected = selectedBuildProducts();

  if (selected.length === 0) {
    window.alert("Select at least one Jimms product before opening the Jimms cart.");
    return;
  }

  const helperWindowName = `jimms-cart-build-${Date.now()}`;
  const helperTab = window.open("about:blank", helperWindowName);
  if (!helperTab) {
    window.alert("Allow pop-ups for this site so the Jimms cart tab can open.");
    return;
  }

  helperTab.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Opening Jimms Cart</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;line-height:1.5;color:#1f2937}strong{display:block;margin-bottom:8px;font-size:1.05rem}</style></head><body><strong>Adding your build to Jimms cart...</strong><p>This tab will open the selected products and then land on Jimms.fi Shopping Cart.</p></body></html>`);
  helperTab.document.close();

  addToJimmsCart.disabled = true;
  addToJimmsCart.textContent = "Preparing Jimms Cart...";

  const resolvedEntries = await Promise.all(selected.map(async (product) => ({
    product,
    cartUrl: await resolveProductCartUrl(product)
  })));

  updateBuildActions();

  const ready = resolvedEntries.filter((entry) => entry.cartUrl);
  const skipped = resolvedEntries.filter((entry) => !entry.cartUrl).map((entry) => entry.product);

  function openManualProductTabs(products, startDelay = 300) {
    products.forEach((product, index) => {
      if (!product.sourceUrl) return;
      window.setTimeout(() => {
        window.open(product.sourceUrl, "_blank", "noopener");
      }, startDelay + (index * 180));
    });
  }

  if (ready.length === 0) {
    helperTab.document.body.innerHTML = "<strong>Opening Jimms product pages for manual add...</strong><p>The shopping cart will open too.</p>";
    window.open("https://www.jimms.fi/fi/ShoppingCart", helperWindowName);
    openManualProductTabs(selected, 260);
    window.setTimeout(() => {
      window.alert(`Jimms did not accept automatic cart adds for this build.\n\nI opened the selected product pages so you can add them manually:\n\n${formatSkippedCartProducts(selected)}`);
    }, 80);
    return;
  }

  if (skipped.length > 0) {
    window.setTimeout(() => {
      window.alert(`These selected part${skipped.length === 1 ? "" : "s"} could not be added automatically to Jimms cart.\n\nTheir Jimms product pages were opened so you can add them manually:\n\n${formatSkippedCartProducts(skipped)}`);
    }, 50);
    openManualProductTabs(skipped, 300);
  }

  const addUrls = ready.map((entry) => entry.cartUrl);
  const startDelayMs = 220;
  const stepDelayMs = 1400;
  addUrls.forEach((url, index) => {
    window.setTimeout(() => {
      window.open(url, helperWindowName);
    }, startDelayMs + (index * stepDelayMs));
  });

  window.setTimeout(() => {
    window.open("https://www.jimms.fi/fi/ShoppingCart", helperWindowName);
  }, startDelayMs + (addUrls.length * stepDelayMs) + 900);
}

function renderSpecTags(card, product) {
  const specs = product.specs || {};
  const tags = [];

  if (specs.valueLabel) tags.push(specs.valueLabel);
  if (specs.thermalLabel) tags.push(specs.thermalLabel);
  if (specs.targetResolution) tags.push(specs.targetResolution);
  if (specs.efficiencyTier) tags.push(`${capitalize(specs.efficiencyTier)} efficiency`);
  if (specs.socket) tags.push(specs.socket);
  if (specs.memoryType) tags.push(specs.memoryType);
  if (specs.formFactor) tags.push(specs.formFactor);
  if (specs.wattage) tags.push(`${specs.wattage}W`);
  if (specs.estimatedWatts) tags.push(`~${specs.estimatedWatts}W`);
  if (specs.coolerType) tags.push(specs.coolerType);
  if (specs.radiatorSize) tags.push(`${specs.radiatorSize}mm`);
  if (specs.coolerHeightMm) tags.push(`${specs.coolerHeightMm}mm tall`);
  if (specs.gpuLengthMm) tags.push(`${specs.gpuLengthMm}mm long`);
  if (specs.psuLengthMm) tags.push(`${specs.psuLengthMm}mm long`);
  if (Array.isArray(specs.supportedSockets) && specs.supportedSockets.length > 0) tags.push(specs.supportedSockets.slice(0, 3).join("/"));
  if (specs.heatRating) tags.push(`${specs.heatRating}W TDP`);
  if (specs.inferredCapacity?.label) tags.push(specs.inferredCapacity.label);
  if (Array.isArray(specs.m2Slots) && specs.m2Slots.length > 0) tags.push(`${specs.m2Slots.length} M.2`);
  if (specs.sataPorts) tags.push(`${specs.sataPorts} SATA`);
  if (specs.maxRadiatorSize) tags.push(`Up to ${specs.maxRadiatorSize}mm rad`);
  if (specs.maxGpuLengthMm) tags.push(`GPU ${specs.maxGpuLengthMm}mm`);
  if (specs.maxCpuCoolerHeightMm) tags.push(`Cooler ${specs.maxCpuCoolerHeightMm}mm`);
  if (specs.maxPsuLengthMm) tags.push(`PSU ${specs.maxPsuLengthMm}mm`);
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

function cleanProductName(product) {
  let name = product.name || "";
  const brand = product.brand || "";
  if (brand && name.toLowerCase().startsWith(`${brand.toLowerCase()} `)) {
    name = name.slice(brand.length).trim();
  }

  if (product.category === "cpu") {
    name = name
      .replace(/,\s*(AM[45]|LGA\s?\d{4,5}|STR5|STRX4|TR4|SP3)\b/gi, "")
      .replace(/,\s*\d+(?:[.,]\d+)?\s*GHz\b/gi, "")
      .replace(/,\s*\d{1,2}\s*-?\s*Core\b/gi, "")
      .replace(/,\s*(WOF|Boxed)\b/gi, "");
  }

  if (product.category === "cooler" || product.category === "aio") {
    name = name
      .replace(/\s+-\s*prosessorijäähdytin\b/gi, "")
      .replace(/\s+prosessorijäähdytin\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  if (product.category === "gpu") {
    name = name
      .replace(/\s+-\s*Pelikoneisiin.*$/gi, "")
      .replace(/\s+-\s*näytönohjain\b/gi, "")
      .replace(/\s+näytönohjain\b/gi, "")
      .replace(/,\s*\d+\s*GB\s*GDDR\d\b/gi, "");
  }

  if (product.category === "motherboard") {
    name = name
      .replace(/,\s*(ATX|mATX|Micro-ATX|Mini-ITX|E-ATX)-?emolevy\b/gi, "")
      .replace(/,\s*emolevy\b/gi, "");
  }

  if (product.category === "memory") {
    name = name
      .replace(/,\s*\d+\s*(?:GB|TB)\s*(?:\([^)]*\))?/gi, "")
      .replace(/,\s*DDR[3-6]\s*\d+\s*MHz\b/gi, "")
      .replace(/,\s*CL\d+\b/gi, "")
      .replace(/,\s*\d+(?:[.,]\d+)?\s*V\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  if (product.category === "storage") {
    name = name
      .replace(/,\s*(?:PCIe\s*\d(?:\.\d)?\s*)?(?:NVMe\s*)?(?:M\.2\s*2280|M\.2|2\.5[”"]?|2,5[”"]?|3\.5[”"]?|3,5[”"]?)\s*(?:SSD|HDD)?-?levy\b/gi, "")
      .replace(/\s+(?:SSD|HDD)?-?levy\b/gi, "")
      .replace(/,\s*(?:NVMe|SATA|PCIe\s*\d(?:\.\d)?(?:\s*x\d+)?|M\.2\s*2280|M\.2|2\.5[”"]?|2,5[”"]?|3\.5[”"]?|3,5[”"]?)\b/gi, "")
      .replace(/,\s*\d+\/\d+\s*MB\/s\b/gi, "");
  }

  if (product.category === "case") {
    name = name
      .replace(/,\s*(ikkunallinen\s*)?(miditornikotelo|mATX-kotelo|ATX-kotelo|Mini-ITX-kotelo|kotelo)\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  if (product.category === "psu") {
    name = name
      .replace(/^\s*\d{3,4}W\s+/i, "")
      .replace(/,\s*ATX-virtalähde\b/gi, "")
      .replace(/,\s*virtalähde\b/gi, "")
      .replace(/,\s*80\s*Plus\s*(?:Bronze|Silver|Gold|Platinum|Titanium)\b/gi, "")
      .replace(/,\s*[^,]*(?:musta|valkoinen|hopea|harmaa|punainen|sininen|kulta)[^,]*$/gi, "");
  }

  return [brand, name.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()].filter(Boolean).join(" ");
}

function productDetailValues(product) {
  const specs = product.specs || {};
  const values = [];
  const source = `${product.name || ""} ${product.description || ""}`;

  if (specs.valueLabel && specs.valueScore) values.push(`${specs.valueLabel} (${specs.valueScore.toFixed(3)} perf/€)`);
  if (specs.thermalLabel) values.push(specs.thermalLabel);
  if (specs.targetResolution) values.push(`${specs.targetResolution} class`);
  if (specs.efficiencyTier) values.push(`${capitalize(specs.efficiencyTier)} efficiency`);
  if (specs.rayTracingIndex) values.push(`RT ${specs.rayTracingIndex}/100`);
  if (specs.vramGb) values.push(`${specs.vramGb}GB VRAM`);
  if (specs.boardPowerW) values.push(`${specs.boardPowerW}W board power`);
  if (specs.socket) values.push(specs.socket);
  if (specs.frequency) values.push(specs.frequency);
  if (specs.cores) values.push(specs.cores);
  if (specs.packageType) values.push(specs.packageType);
  if (specs.memoryType) values.push(specs.memoryType);
  if (specs.formFactor) values.push(specs.formFactor);
  if (specs.coolerType) values.push(specs.coolerType);
  if (specs.radiatorSize) values.push(`${specs.radiatorSize}mm radiator`);
  if (specs.coolerHeightMm) values.push(`${specs.coolerHeightMm}mm cooler height`);
  if (specs.gpuLengthMm) values.push(`${specs.gpuLengthMm}mm GPU length`);
  if (specs.psuLengthMm) values.push(`${specs.psuLengthMm}mm PSU length`);
  if (Array.isArray(specs.radiatorSupport) && specs.radiatorSupport.length > 0) {
    values.push(`Radiators: ${formatRadiatorSupport(specs.radiatorSupport)}`);
  }
  if (specs.color) values.push(specs.color);
  if (Array.isArray(specs.supportedSockets) && specs.supportedSockets.length > 0) values.push(`Sockets: ${specs.supportedSockets.join(", ")}`);
  if (specs.heatRating) values.push(`${specs.heatRating}W heat rating`);
  if (!specs.heatRating && specs.inferredCapacity?.label) values.push(specs.inferredCapacity.label);
  if (Array.isArray(specs.m2Slots) && specs.m2Slots.length > 0) values.push(`${specs.m2Slots.length} M.2 slots`);
  if (Array.isArray(specs.pcieSlots) && specs.pcieSlots.length > 0) values.push(`${specs.pcieSlots.length} PCIe slots`);
  if (specs.sataPorts) values.push(`${specs.sataPorts} SATA`);
  if (specs.memorySlots) values.push(`${specs.memorySlots} DIMM`);
  if (specs.capacity) values.push(specs.capacity);
  if (specs.speed) values.push(specs.speed);
  if (specs.casLatency) values.push(specs.casLatency);
  if (specs.voltage) values.push(specs.voltage);
  if (specs.interface) values.push(specs.interface);
  if (specs.efficiency) values.push(specs.efficiency);
  if (specs.modularity) values.push(specs.modularity);
  if (specs.wattage) values.push(`${specs.wattage}W`);
  if (specs.estimatedWatts) values.push(`~${specs.estimatedWatts}W`);

  const pcie = source.match(/\bPCIe\s*\d(?:\.\d)?(?:\s*x\d+)?\b/i);
  if (pcie) values.push(pcie[0].replace(/\s+/g, " "));

  const capacity = source.match(/\b\d+\s*(?:GB|TB)\b/i);
  if (capacity) values.push(capacity[0].replace(/\s+/g, ""));

  if (Array.isArray(specs.supportedFormFactors) && specs.supportedFormFactors.length > 0) {
    values.push(`Fits ${specs.supportedFormFactors.join(", ")}`);
  }
  if (specs.maxGpuLengthMm) values.push(`GPU up to ${specs.maxGpuLengthMm}mm`);
  if (specs.maxCpuCoolerHeightMm) values.push(`Cooler up to ${specs.maxCpuCoolerHeightMm}mm`);
  if (specs.maxPsuLengthMm) values.push(`PSU up to ${specs.maxPsuLengthMm}mm`);

  return [...new Set(values.filter(Boolean))];
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function formatRadiatorLocation(location) {
  return {
    front: "front",
    top: "top",
    rear: "rear",
    bottom: "bottom",
    side: "side",
    listed: "listed"
  }[location] || location;
}

function formatRadiatorSupport(support) {
  return support
    .map((mount) => `${formatRadiatorLocation(mount.location)} ${mount.sizes.join("/")}mm`)
    .join(", ");
}

function findRadiatorMount(support, radiatorSize) {
  return support.find((mount) => mount.sizes.some((size) => size >= radiatorSize));
}

function renderProductDetails(card, product) {
  const detailWrap = card.querySelector(".product-details");
  const values = productDetailValues(product);
  detailWrap.innerHTML = "";

  if (values.length === 0) {
    detailWrap.hidden = true;
    return;
  }

  values.slice(0, 7).forEach((value) => {
    const item = document.createElement("span");
    item.textContent = value;
    if (/value/i.test(value)) item.dataset.tone = "value";
    if (/thermals|cool-running|runs warm/i.test(value)) item.dataset.tone = "thermal";
    detailWrap.append(item);
  });
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

function compareDimensionFit(checks, itemLabel, itemSize, limitLabel, limitSize, detailLoaded, readyText, missingLimitText, loadingText) {
  if (!itemSize) return false;

  if (limitSize) {
    if (itemSize <= limitSize) {
      addCheck(checks, "ok", readyText(itemSize, limitSize));
    } else {
      addCheck(checks, "error", `${itemLabel} ${itemSize}mm exceeds the case ${limitLabel} limit of ${limitSize}mm.`);
    }
    return true;
  }

  if (detailLoaded && missingLimitText) {
    addCheck(checks, "warn", missingLimitText(itemSize));
  } else if (loadingText) {
    addCheck(checks, "info", loadingText(itemSize));
  }

  return true;
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
    const cpuSocket = parts.cpu.specs?.socket;
    const supportedSockets = cooler.specs?.supportedSockets || [];
    const heatRating = cooler.specs?.heatRating || 0;

    if (cpuSocket && supportedSockets.length > 0) {
      if (supportedSockets.includes(cpuSocket)) {
        addCheck(checks, "ok", `CPU cooler supports ${cpuSocket}.`);
      } else {
        addCheck(checks, "error", `CPU cooler socket support does not list ${cpuSocket}. Listed sockets: ${supportedSockets.join(", ")}.`);
      }
    } else if (cooler.detailSource) {
      addCheck(checks, "warn", "Cooler socket support was not found on the Jimms product page.");
    } else {
      addCheck(checks, "info", "Cooler socket support is loading from the Jimms product page.");
    }

    if (heatRating && cpuWatts) {
      if (heatRating >= Math.ceil(cpuWatts * 1.15)) {
        addCheck(checks, "ok", `Cooler heat rating ${heatRating}W covers the estimated ${cpuWatts}W CPU load.`);
      } else {
        addCheck(checks, "warn", `Cooler heat rating ${heatRating}W is close to or below the estimated ${cpuWatts}W CPU load.`);
      }
    } else if (cooler.detailSource) {
      const capacity = cooler.specs?.inferredCapacity;
      if (capacity?.tier === "high" && cpuWatts <= 170) {
        addCheck(checks, "ok", `Jimms does not list a heat rating, but this is a ${capacity.label}, which is a reasonable class for the estimated ${cpuWatts}W CPU load.`);
      } else if (capacity?.tier === "high") {
        addCheck(checks, "warn", `Jimms does not list a heat rating. This is a ${capacity.label}, but confirm reviews/manufacturer specs for an estimated ${cpuWatts}W CPU load.`);
      } else if (capacity?.tier === "medium" && cpuWatts <= 125) {
        addCheck(checks, "ok", `Jimms does not list a heat rating, but this ${capacity.label} is a reasonable class for the estimated ${cpuWatts}W CPU load.`);
      } else if (capacity?.label) {
        addCheck(checks, "warn", `Jimms does not list a heat rating. The cooler appears to be ${capacity.label}; confirm manufacturer specs for an estimated ${cpuWatts}W CPU load.`);
      } else {
        addCheck(checks, "info", "Jimms does not list a cooler heat rating for this product.");
      }
    }

    if (coolerType === "AIO" && radiator > 0) {
      if (cpuWatts >= 170 && radiator < 280) {
        addCheck(checks, "warn", `A high-power CPU is paired with a ${radiator}mm AIO. Consider 280mm or larger.`);
      } else {
        addCheck(checks, "ok", `${radiator}mm AIO is a reasonable cooler class for the selected CPU.`);
      }
    } else if (cpuWatts >= 170 && !heatRating) {
      addCheck(checks, "warn", "High-power CPU selected. Prefer a cooler with a clearly listed high heat rating.");
    } else if (!parts.case) {
      addCheck(checks, "info", "Air cooler physical clearance still depends on case and RAM height.");
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
    const radiatorSize = parts.cooling.specs.radiatorSize;
    const radiatorSupport = parts.case.specs?.radiatorSupport || [];
    const mount = findRadiatorMount(radiatorSupport, radiatorSize);

    if (mount) {
      addCheck(checks, "ok", `Case lists ${formatRadiatorLocation(mount.location)} radiator support for ${mount.sizes.join("/")}mm, so the ${radiatorSize}mm AIO should fit.`);
    } else if (radiatorSupport.length > 0) {
      addCheck(checks, "error", `Selected case radiator support appears limited to ${formatRadiatorSupport(radiatorSupport)}; it may not fit a ${radiatorSize}mm AIO.`);
    } else if (parts.case.detailSource) {
      addCheck(checks, "warn", `Jimms case page did not list radiator clearance. Confirm the case supports a ${radiatorSize}mm radiator.`);
    } else {
      addCheck(checks, "info", `Case radiator clearance is loading from the Jimms product page for the ${radiatorSize}mm AIO.`);
    }
  }

  if (parts.case && parts.cooling?.specs?.coolerType === "Air" && parts.cooling?.specs?.coolerHeightMm) {
    compareDimensionFit(
      checks,
      "Air cooler height",
      parts.cooling.specs.coolerHeightMm,
      "CPU cooler",
      parts.case.specs?.maxCpuCoolerHeightMm,
      Boolean(parts.case.detailSource),
      (itemSize, limitSize) => `Air cooler height ${itemSize}mm fits within the case CPU cooler limit of ${limitSize}mm.`,
      (itemSize) => `Jimms case page did not list CPU cooler height clearance. Confirm the case fits a ${itemSize}mm air cooler.`,
      (itemSize) => `Case CPU cooler clearance is loading from the Jimms product page for the ${itemSize}mm air cooler.`
    );
  } else if (parts.case && parts.cooling?.specs?.coolerType === "Air" && parts.cooling?.detailSource) {
    addCheck(checks, "warn", "Jimms cooler page did not list air cooler height for this product.");
  }

  if (parts.case && parts.gpu?.specs?.gpuLengthMm) {
    compareDimensionFit(
      checks,
      "GPU length",
      parts.gpu.specs.gpuLengthMm,
      "GPU",
      parts.case.specs?.maxGpuLengthMm,
      Boolean(parts.case.detailSource),
      (itemSize, limitSize) => `GPU length ${itemSize}mm fits within the case GPU limit of ${limitSize}mm.`,
      (itemSize) => `Jimms case page did not list GPU clearance. Confirm the case fits a ${itemSize}mm graphics card.`,
      (itemSize) => `Case GPU clearance is loading from the Jimms product page for the ${itemSize}mm graphics card.`
    );
  } else if (parts.case && parts.gpu?.detailSource) {
    addCheck(checks, "warn", "Jimms GPU page did not list card length for this product.");
  }

  if (parts.case && parts.psu?.specs?.psuLengthMm) {
    compareDimensionFit(
      checks,
      "PSU length",
      parts.psu.specs.psuLengthMm,
      "PSU",
      parts.case.specs?.maxPsuLengthMm,
      Boolean(parts.case.detailSource),
      (itemSize, limitSize) => `PSU length ${itemSize}mm fits within the case PSU limit of ${limitSize}mm.`,
      (itemSize) => `Jimms case page did not list PSU clearance. Confirm the case fits a ${itemSize}mm power supply.`,
      (itemSize) => `Case PSU clearance is loading from the Jimms product page for the ${itemSize}mm power supply.`
    );
  } else if (parts.case && parts.psu?.detailSource) {
    addCheck(checks, "warn", "Jimms PSU page did not list PSU length for this product.");
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

  if (parts.storage && parts.motherboard) {
    const storageText = `${parts.storage.name || ""} ${parts.storage.description || ""}`;
    const needsM2 = /M\.2|NVMe/i.test(storageText);
    const needsSata = /\bSATA\b/i.test(storageText);
    const m2Slots = parts.motherboard.specs?.m2Slots || [];
    const sataPorts = parts.motherboard.specs?.sataPorts || 0;

    if (needsM2) {
      if (m2Slots.length > 0) {
        addCheck(checks, "ok", `Motherboard lists ${m2Slots.length} M.2 slot${m2Slots.length === 1 ? "" : "s"} for M.2/NVMe storage.`);
      } else if (parts.motherboard.detailSource) {
        addCheck(checks, "warn", "Selected storage is M.2/NVMe, but no M.2 slot details were found on the motherboard page.");
      } else {
        addCheck(checks, "info", "Motherboard slot details are loading from the Jimms product page.");
      }
    }

    if (needsSata) {
      if (sataPorts > 0) {
        addCheck(checks, "ok", `Motherboard lists ${sataPorts} SATA port${sataPorts === 1 ? "" : "s"}.`);
      } else if (parts.motherboard.detailSource) {
        addCheck(checks, "warn", "Selected storage appears to use SATA, but SATA port details were not found.");
      }
    }
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
  resetCurrentBuild(true);
  renderPartRows();
});

addToJimmsCart.addEventListener("click", openBuildInJimmsCart);
themeToggle.addEventListener("click", toggleTheme);
buildNameInput.addEventListener("input", () => {
  state.currentBuildName = buildNameInput.value.trim() || "My Build";
  savedBuildButtonLabel();
  persistCurrentBuild();
});
saveBuildButton.addEventListener("click", async () => {
  try {
    await saveCurrentBuild();
  } catch (error) {
    window.alert("Could not save this build right now.");
  }
});
newBuildButton.addEventListener("click", () => {
  resetCurrentBuild(true);
  renderPartRows();
});
registerButton.addEventListener("click", async () => {
  syncAuthEmails(state.auth.user?.email || "");
  openAuthView("register");
});
loginButton.addEventListener("click", async () => {
  syncAuthEmails(state.auth.user?.email || "");
  openAuthView("login");
});
forgotPasswordButton.addEventListener("click", async () => {
  syncAuthEmails(state.auth.user?.email || "");
  openAuthView("forgot");
});
testEmailButton.addEventListener("click", async () => {
  try {
    await sendTestEmail();
  } catch (error) {
    setAuthStatus(error.message || "Could not send test email.", "warn");
  }
});
closeAuthScreenButton.addEventListener("click", closeAuthView);
authBackdrop.addEventListener("click", closeAuthView);
switchToLoginButton.addEventListener("click", () => {
  syncAuthEmails(registerEmailInput.value.trim());
  openAuthView("login");
});
switchToForgotButton.addEventListener("click", () => {
  syncAuthEmails(loginEmailInput.value.trim());
  openAuthView("forgot");
});
registerPage.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitLocalAuth("register");
  } catch (error) {
    setAuthStatus(error.message || "Could not create that account.", "warn");
  }
});
loginPage.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitLocalAuth("login");
  } catch (error) {
    setAuthStatus(error.message || "Could not sign in.", "warn");
  }
});
requestResetButton.addEventListener("click", async () => {
  try {
    await requestPasswordReset();
  } catch (error) {
    setAuthStatus(error.message || "Could not start password reset.", "warn");
  }
});
forgotPage.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitPasswordReset();
  } catch (error) {
    setAuthStatus(error.message || "Could not reset password.", "warn");
  }
});
sendTestEmailButton.addEventListener("click", async () => {
  try {
    await sendTestEmail();
  } catch (error) {
    setAuthStatus(error.message || "Could not send test email.", "warn");
  }
});
signOutButton.addEventListener("click", () => {
  const headers = authHeaders();
  state.auth.token = "";
  state.auth.user = null;
  state.savedBuilds = loadLocalSavedBuilds();
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  fetch("/api/auth/local/logout", {
    method: "POST",
    headers
  }).catch(() => {});
  clearResetInputs();
  closeAuthView();
  setAuthStatus("Signed out.");
  renderAuthState();
  renderSavedBuilds();
});

applyTheme(getStoredTheme());
restoreCurrentBuild();
updateBuildNameInput();
renderTabs();
renderPartRows();
loadProducts();
loadAuthConfig();
