// main.js (ES module) — persist cart to localStorage and redirect Checkout to checkout.html
const API = "https://deliveraau.onrender.com/api";

/* ---------- State ---------- */
let cart = loadCart(); // load persisted cart on script start
let lastItems = [];

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const formatPrice = (v) => `${Number(v).toLocaleString()} birr`;
const escapeHtml = (s) => String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function loadCart() {
  try {
    const raw = localStorage.getItem("ub_cart");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to load cart from localStorage", e);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem("ub_cart", JSON.stringify(cart));
  } catch (e) {
    console.warn("Failed to save cart to localStorage", e);
  }
}

/* ---------- DOM refs ---------- */
const itemsContainer = $("#items");
const cartBtn = $("#cartBtn");
const cartCount = $("#cartCount");
const summaryText = $("#summaryText");
const summaryPrice = $("#summaryPrice");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearCartBtn = $("#clearCartBtn");
const cartModal = $("#cartModal");
const cartBackdrop = $("#cartBackdrop");
const closeCart = $("#closeCart");
const cartList = $("#cartList");
const cartTotal = $("#cartTotal");
const modalCheckout = $("#modalCheckout");
const searchInput = $("#searchInput");
const refreshBtn = $("#refreshBtn");

/* ---------- Wire Checkout button to redirect ---------- */
checkoutBtn.addEventListener("click", () => {
  // ensure cart is saved before redirect
  saveCart();
  // redirect to dedicated checkout page
  window.location.href = "/checkout.html";
});

// modal "Place Order" should also redirect to checkout page (preview only)
modalCheckout.addEventListener("click", () => {
  saveCart();
  window.location.href = "/checkout.html";
});

/* ---------- Fetch ---------- */
async function fetchItems() {
  try {
    const res = await fetch(`${API}/asbeza/items`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error("Failed to fetch items:", err);
    return [];
  }
}

/* ---------- Render ---------- */
function renderItems(items) {
  itemsContainer.innerHTML = "";
  if (!items.length) {
    itemsContainer.innerHTML = `<div class="col-span-full text-center text-slate-400 py-12">No items available right now.</div>`;
    return;
  }

  items.forEach(item => {
    const price = item.base_price ?? item.price ?? 0;
    const card = document.createElement("article");
    card.className = "rounded-2xl p-4 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/6 shadow-lg flex flex-col justify-between hover:scale-[1.01] transition-transform";

    card.innerHTML = `
      <div class="flex items-start gap-4">
        <div class="w-20 h-20 rounded-xl flex items-center justify-center text-white text-sm font-bold"
             style="background: linear-gradient(135deg, var(--brand-grad-1), var(--brand-grad-2));">
          ${escapeHtml((item.name || "").slice(0,2).toUpperCase())}
        </div>
        <div class="flex-1">
          <h4 class="text-white font-semibold leading-tight">${escapeHtml(item.name)}</h4>
          <p class="text-slate-400 text-sm mt-1 line-clamp-2">${escapeHtml(item.description || "")}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <div class="text-white font-bold">${formatPrice(price)}</div>
        <div class="flex items-center gap-2">
          <button class="add-btn inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/6 hover:bg-white/10 transition">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="text-sm text-white">Add</span>
          </button>
        </div>
      </div>
    `;

    card.querySelector(".add-btn").addEventListener("click", () => {
      addToCart({
        id: item.id,
        name: item.name,
        description: item.description,
        price,
        variant_id: item.variant_id ?? null
      });
      pulseCart();
    });

    itemsContainer.appendChild(card);
  });
}

/* ---------- Cart logic (persist on every change) ---------- */
function addToCart(item) {
  const existing = cart.find(c => c.id === item.id && c.variant_id === item.variant_id);
  if (existing) existing.quantity += 1;
  else cart.push({ ...item, quantity: 1 });
  saveCart();
  updateCartUI();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
}

function changeQty(index, delta) {
  cart[index].quantity = Math.max(1, cart[index].quantity + delta);
  saveCart();
  updateCartUI();
}

function cartSummary() {
  const total = cart.reduce((s, it) => s + (it.price * (it.quantity || 1)), 0);
  const count = cart.reduce((s, it) => s + (it.quantity || 1), 0);
  return { total, count };
}

function updateCartUI() {
  const { total, count } = cartSummary();
  cartCount.textContent = String(count);
  summaryText.textContent = count ? `${count} item${count>1?'s':''} in cart` : "No items in cart";
  summaryPrice.textContent = formatPrice(total);
  cartTotal.textContent = formatPrice(total);

  // render cart preview list
  cartList.innerHTML = "";
  cart.forEach((it, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between gap-4";
    row.innerHTML = `
      <div class="flex-1">
        <div class="text-white font-medium">${escapeHtml(it.name)}</div>
        <div class="text-slate-400 text-sm">${escapeHtml(it.quantity)} × ${formatPrice(it.price)}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="qty-btn px-2 py-1 rounded bg-slate-700 text-sm">−</button>
        <button class="remove-btn px-2 py-1 rounded bg-rose-600 text-sm">Remove</button>
      </div>
    `;
    row.querySelector(".qty-btn").addEventListener("click", () => changeQty(idx, -1));
    row.querySelector(".remove-btn").addEventListener("click", () => removeCartItem(idx));
    cartList.appendChild(row);
  });
}

/* ---------- UI helpers ---------- */
function openCart() { cartModal.classList.remove("hidden"); cartModal.classList.add("flex"); renderCartPreview(); }
function closeCartModal() { cartModal.classList.add("hidden"); cartModal.classList.remove("flex"); }
function pulseCart() {
  cartBtn.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 260 });
}

/* ---------- Cart preview rendering (used when opening modal) ---------- */
function renderCartPreview() {
  const list = cartList;
  list.innerHTML = '';
  if (!cart.length) {
    list.innerHTML = '<div class="text-slate-400">Your cart is empty</div>';
    return;
  }
  cart.forEach((it, idx) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-4';
    row.innerHTML = `
      <div class="flex-1">
        <div class="text-white font-medium">${escapeHtml(it.name)}</div>
        <div class="text-slate-400 text-sm">${escapeHtml((it.quantity||1) + ' × ' + (it.price || 0) + ' birr')}</div>
      </div>
      <div class="flex items-center gap-2">
        <button data-idx="${idx}" class="qty-btn px-2 py-1 rounded bg-slate-700 text-sm">−</button>
        <button data-idx="${idx}" class="remove-btn px-2 py-1 rounded bg-rose-600 text-sm">Remove</button>
      </div>
    `;
    list.appendChild(row);
  });

  // attach handlers
  list.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.idx);
      changeQty(idx, -1);
      renderCartPreview();
    });
  });
  list.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.idx);
      removeCartItem(idx);
      renderCartPreview();
    });
  });
}

/* ---------- Toast helper ---------- */
function toast(message, { type = "info", duration = 3000 } = {}) {
  const el = document.createElement("div");
  el.className = `fixed right-6 bottom-24 z-50 px-4 py-2 rounded-lg text-sm ${type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-slate-700"} text-white shadow-lg`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ---------- Events ---------- */
cartBtn.addEventListener("click", openCart);
cartBackdrop.addEventListener("click", closeCartModal);
closeCart.addEventListener("click", closeCartModal);
clearCartBtn.addEventListener("click", clearCart);
refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";
  await init();
  refreshBtn.disabled = false;
  refreshBtn.textContent = "Refresh";
});

searchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = lastItems.filter(i => (i.name || "").toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q));
  renderItems(filtered);
});

/* ---------- Init ---------- */
async function init() {
  itemsContainer.innerHTML = `<div class="col-span-full text-center text-slate-400 py-12">Loading…</div>`;
  const items = await fetchItems();
  lastItems = items;
  renderItems(items);
  updateCartUI();
}


init();
