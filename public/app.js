const categories = [
  ["cpu", "CPU"],
  ["gpu", "GPU"],
  ["motherboard", "Motherboard"],
  ["memory", "Memory"],
  ["storage", "Storage"],
  ["case", "Case"],
  ["psu", "PSU"]
];

const jimmsUrls = {
  cpu: "https://www.jimms.fi/fi/Product/List/000-00R",
  gpu: "https://www.jimms.fi/fi/Product/List/000-00P",
  motherboard: "https://www.jimms.fi/fi/Product/List/000-00H",
  memory: "https://www.jimms.fi/fi/Product/List/000-00N",
  storage: "https://www.jimms.fi/fi/Product/List/000-00K",
  case: "https://www.jimms.fi/fi/Product/List/000-00J",
  psu: "https://www.jimms.fi/fi/Product/List/000-00U"
};

const state = {
  activeCategory: "cpu",
  selected: Object.fromEntries(categories.map(([key]) => [key, null])),
  products: []
};

const partList = document.querySelector("#partList");
const categoryTabs = document.querySelector("#categoryTabs");
const productsEl = document.querySelector("#products");
const productTemplate = document.querySelector("#productTemplate");
const partRowTemplate = document.querySelector("#partRowTemplate");
const searchInput = document.querySelector("#searchInput");
const totalPrice = document.querySelector("#totalPrice");
const catalogTitle = document.querySelector("#catalogTitle");
const catalogMeta = document.querySelector("#catalogMeta");
const sourcePill = document.querySelector("#sourcePill");
const jimmsLink = document.querySelector("#jimmsLink");
const clearBuild = document.querySelector("#clearBuild");

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
  }).format(value);
}

function categoryLabel(key) {
  return categories.find(([id]) => id === key)?.[1] || key;
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
      searchInput.value = "";
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
}

function renderProducts() {
  productsEl.innerHTML = "";

  if (state.products.length === 0) {
    productsEl.innerHTML = `<div class="empty">No Jimms.fi products matched that search.</div>`;
    return;
  }

  state.products.forEach((product) => {
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
    card.querySelector("button").addEventListener("click", () => {
      state.selected[state.activeCategory] = product;
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
  jimmsLink.href = jimmsUrls[state.activeCategory];

  try {
    const response = await fetch(`/api/products?category=${encodeURIComponent(state.activeCategory)}&q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    const data = await response.json();
    state.products = data.products || [];
    catalogMeta.textContent = `${state.products.length} ${label.toLowerCase()} results`;
    sourcePill.textContent = data.source || "Jimms.fi";
    renderProducts();
  } catch (error) {
    state.products = [];
    sourcePill.textContent = "Jimms.fi source unavailable";
    catalogMeta.textContent = error.message;
    renderProducts();
  }
}

function updateTotal() {
  const total = Object.values(state.selected).reduce((sum, item) => {
    return sum + (item ? parseEuro(item.price) : 0);
  }, 0);
  totalPrice.textContent = formatEuro(total);
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

clearBuild.addEventListener("click", () => {
  Object.keys(state.selected).forEach((key) => {
    state.selected[key] = null;
  });
  renderPartRows();
});

renderTabs();
renderPartRows();
loadProducts();
