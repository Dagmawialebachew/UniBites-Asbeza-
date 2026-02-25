// main.js (ES module) — persist cart to localStorage and redirect Checkout to checkout.html
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:8000/api"
    : "https://deliveraau.onrender.com/api";

/* ---------- State ---------- */
let cart = loadCart(); // load persisted cart on script start
let lastItems = [];

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const formatPrice = (v) => `${Number(v).toLocaleString()} `;
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



function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}


const tg = window.Telegram?.WebApp;
let telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ??
getQueryParam("user_id");
console.log('Telegram user id', telegramUserId )
telegramUserId = telegramUserId ? parseInt(telegramUserId, 10) : null;


if (telegramUserId) {
  localStorage.setItem("ub_user_id", telegramUserId);
  console.log("User ID from query:", telegramUserId);
} else {
  console.log("No user_id found in query params");
}

const userId = localStorage.getItem("ub_user_id");
const trial_id = document.getElementById('trial_id')
trial_id.textContent = `Hello, User ${userId || "Guest"}!`;
if (userId) {
  fetch(`${API}/auth/role?user_id=${userId}`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "ok") {
        if (data.role === "delivery") {
          window.location.href = "delivery.html";
        } else {
          window.location.href = "index.html";
        }
      } else {
        console.error("Role lookup failed:", data.message);
        // fallback: send to index.html
        window.location.href = "index.html";
      }
    })
    .catch(err => {
      console.error("Role API error:", err);
      window.location.href = "index.html";
    });
}

/* ---------- UI Preview Logic ---------- */
const UI = {
  currentCategory: 'all',
  selectedCategories: [],

  handleFiltering() {
    const searchEl = document.getElementById('searchInput');
    const searchVal = searchEl ? searchEl.value.trim().toLowerCase() : '';

    const filtered = (this.allItems || []).filter(item => {
      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const matchesSearch = !searchVal || name.includes(searchVal) || desc.includes(searchVal);
      const matchesCategory = this.selectedCategories.length === 0 || this.selectedCategories.includes(item.category);
      return matchesSearch && matchesCategory;
    });

    if (typeof this.renderItems === "function") {
      this.renderItems(filtered);
    } else if (typeof renderItems === "function") {
      renderItems(filtered);
    }
  },

  openPreview(url, name, variants = [], productId = null) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('previewFullImg');
    const title = document.getElementById('previewTitle');
    const variantBox = document.getElementById('previewVariants');

    if (!modal) return;
    if (!url || url === 'undefined') return;

    // Load fresh cart from storage
    let currentCart = loadCart();

    // Find cart entry by product id
    const itemInCart = productId != null ? currentCart.find(c => c.id === productId) : undefined;
    const currentSelectedId = itemInCart?.variant_id ?? null;

    // Set initial image and title
    const initialVariant = variants.find(v => v.id === currentSelectedId);
    if (img) img.src = (initialVariant && initialVariant.image_url) ? initialVariant.image_url : url;
    if (title) title.textContent = name || '';

    // Render variants
    if (variantBox) {
      if (variants.length) {
        variantBox.innerHTML = `
          <div class="space-y-4 relative">
            <div id="variantToast" class="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-orange-500 text-black text-[9px] font-black uppercase tracking-widest rounded-full opacity-0 translate-y-2 transition-all duration-300 pointer-events-none z-20 shadow-xl border border-black/10">
              Option Updated
            </div>

            <div class="flex items-center justify-between px-1">
              <h4 class="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Select Your Option</h4>
              <span class="text-[9px] text-orange-500 font-bold uppercase tracking-widest">Active Choice</span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${variants.map(v => {
                const isActive = v.id === currentSelectedId;
                return `
                <button 
                  type="button"
                  class="variant-btn group relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${isActive ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(255,122,0,0.15)]' : 'bg-white/5 border-white/5 hover:border-white/20'}"
                  data-id="${v.id}" 
                  data-price="${v.price}" 
                  data-name="${escapeHtml(v.name)}" 
                  data-image="${v.image_url || url}"
                  data-productid="${productId}">
                  
                  <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isActive ? 'border-orange-500 bg-orange-500' : 'border-white/20 bg-transparent'}">
                    ${isActive ? '<i class="fa-solid fa-check text-black text-[10px]"></i>' : ''}
                  </div>

                  <div class="flex flex-col items-start">
                    <span class="text-[11px] font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-300'}">
                      ${escapeHtml(v.name)}
                    </span>
                    <span class="text-[10px] font-bold ${isActive ? 'text-orange-500' : 'text-slate-500'}">
                      ${formatPrice(v.price)}
                    </span>
                  </div>
                </button>
              `}).join("")}
            </div>
          </div>
        `;
      } else {
        variantBox.innerHTML = `<p class="text-slate-500 text-xs italic">No variants available</p>`;
      }
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Attach click handlers for variant buttons (defensive)
    document.querySelectorAll(".variant-btn").forEach(btn => {
      btn.replaceWith(btn.cloneNode(true)); // remove previous listeners
    });

    document.querySelectorAll(".variant-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const vId = Number(btn.dataset.id);
        const vPrice = Number(btn.dataset.price);
        const vName = btn.dataset.name;
        const vImage = btn.dataset.image;
        const pid = Number(btn.dataset.productid);

        // Update visuals immediately
        document.querySelectorAll(".variant-btn").forEach(b => {
          const isThis = Number(b.dataset.id) === vId;
          b.className = `variant-btn group relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${isThis ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(255,122,0,0.15)]' : 'bg-white/5 border-white/5 hover:border-white/20'}`;
          const circle = b.querySelector('.w-5');
          if (circle) {
            circle.className = `w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isThis ? 'border-orange-500 bg-orange-500' : 'border-white/20 bg-transparent'}`;
            circle.innerHTML = isThis ? '<i class="fa-solid fa-check text-black text-[10px]"></i>' : '';
          }
        });

        // Persist selection by product id
        currentCart = loadCart();
        let entry = currentCart.find(c => c.id === pid);
        if (!entry) {
          currentCart.push({
            id: pid,
            name: name,
            variant_id: vId,
            price: vPrice,
            quantity: 1,
            image_url: vImage,
            variants: variants
          });
        } else {
          entry.variant_id = vId;
          entry.price = vPrice;
          entry.image_url = vImage;
        }

        // Save and update UI hooks
        saveCart(currentCart);
        if (typeof updateCartUI === "function") updateCartUI();
        if (typeof renderCartPreview === "function") renderCartPreview();
        if (typeof updateSummaryUI === "function") updateSummaryUI();

        if (img) img.src = vImage || url;

        if (typeof updateVariant === "function") {
          updateVariant(pid, { id: vId, name: vName, price: vPrice, image_url: vImage });
        }

        // Toast feedback
        const toast = document.getElementById('variantToast');
        if (toast) {
          toast.textContent = `Selected: ${vName}`;
          toast.classList.remove('opacity-0', 'translate-y-2');
          toast.classList.add('opacity-100', 'translate-y-0');
          setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            toast.classList.remove('opacity-100', 'translate-y-0');
          }, 1200);
        }
      });
    });
  },

  closePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
};

// expose UI
window.UI = UI;

/* ---------- Filter helpers (keep existing global constants if present) ---------- */
const ASBEZA_CATEGORIES = ["Staples", "Vegetables", "Snacks", "Drinks", "Personal Care", "Other"];

// Toggle filter menu


// Initialize filter pills and controls
// Live active filters container update
UI.updateActiveFilters = function() {
  const container = document.getElementById('activeFilters');
  const countLabel = document.getElementById('filterCount');
  if (!container) return;

  if (this.selectedCategories.length === 0) {
    container.innerHTML = '<p class="text-[10px] text-slate-600 italic mono uppercase pl-1">No Active Filters</p>';
    if(countLabel) countLabel.textContent = "0 SELECTED";
    return;
  }

  if(countLabel) countLabel.textContent = `${this.selectedCategories.length} SELECTED`;

  // Render chips inside the overlay
  const chips = this.selectedCategories.map(cat => `
    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-[9px] mono uppercase text-orange-500">
      ${escapeHtml(cat)}
      <button type="button" data-cat="${escapeHtml(cat)}" class="remove-filter hover:text-white">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </span>
  `).join('');

  container.innerHTML = chips;

  // Re-bind remove buttons
  container.querySelectorAll('.remove-filter').forEach(btn => {
    btn.onclick = (e) => {
      const cat = btn.dataset.cat;
      this.selectedCategories = this.selectedCategories.filter(c => c !== cat);
      
      // Update the main pills UI
      const pill = document.querySelector(`.multi-cat-pill[data-cat="${cat}"]`);
      if (pill) pill.classList.remove('active-pill');

      const dot = document.getElementById('filterActiveDot');
      if (dot) dot.classList.toggle('hidden', this.selectedCategories.length === 0);
      
      this.updateActiveFilters();
      this.handleFiltering();
    };
  });
};

// Toggle filter menu (toggle hidden/block)
UI.toggleFilterMenu = function() {
  const menu = document.getElementById('filterMenu');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  
  if (isHidden) {
    menu.classList.remove('hidden');
    document.body.classList.add('filter-open'); // Stops background scroll
  } else {
    menu.classList.add('hidden');
    document.body.classList.remove('filter-open'); // Restores scroll
  }
};

// Initialize filter pills and controls (multi-select + live chips)
UI.initFilters = function() {
  const container = document.getElementById('multiCategoryContainer');
  if (!container) return;

  // Use a cleaner button style
  container.innerHTML = ASBEZA_CATEGORIES.map(cat => `
    <button type="button" data-cat="${escapeHtml(cat)}" 
      class="multi-cat-pill flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-[10px] mono text-slate-400 text-left transition-all duration-300">
      ${escapeHtml(cat)}
      <div class="indicator w-1.5 h-1.5 rounded-full bg-white/10"></div>
    </button>
  `).join('');

  container.querySelectorAll('.multi-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (UI.selectedCategories.includes(cat)) {
        UI.selectedCategories = UI.selectedCategories.filter(c => c !== cat);
        btn.classList.remove('active-pill');
      } else {
        UI.selectedCategories.push(cat);
        btn.classList.add('active-pill');
      }
      
      const dot = document.getElementById('filterActiveDot');
      if (dot) dot.classList.toggle('hidden', UI.selectedCategories.length === 0);

      UI.updateActiveFilters();
      UI.handleFiltering();
    });
  });

  // Toggle/Clear/Apply remain the same...
  document.getElementById('filterToggleBtn').onclick = () => UI.toggleFilterMenu();
  document.getElementById('clearFiltersBtn').onclick = () => {
    UI.selectedCategories = [];
    container.querySelectorAll('.multi-cat-pill').forEach(b => b.classList.remove('active-pill'));
    document.getElementById('filterActiveDot')?.classList.add('hidden');
    UI.updateActiveFilters();
    UI.handleFiltering();
  };
  document.getElementById('applyFiltersBtn').onclick = () => UI.toggleFilterMenu();

  UI.updateActiveFilters();
};


document.addEventListener('DOMContentLoaded', () => {
  

  // initialize category pills
  if (typeof UI.initFilters === "function") {
    UI.initFilters();
  }
});


/* ---------- DOM refs ---------- */
const itemsContainer = $("#items");
const cartBtn = $("#cartBtn");
const cartCount = $("#cartCount");
// const summaryText = $("#summaryText");
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
  const cart = window.__UB_CART || [];

  // calculate totals
  const totalQty = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const totalPrice = cart.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 1)), 0);

  // enforce minimums: must have at least 5 items OR 600 Birr
  console.log('cart:', cart);
  console.log('Checkout clicked - totalQty:', totalQty, 'totalPrice:', totalPrice);
  if (totalQty < 5 && totalPrice < 600) {
    alert("⚠️ You need at least 5 items OR a total of 600 Birr to proceed to checkout.");
    // stay on the same page and refresh cart UI
    renderCartPreview();
    updateSummaryUI();
    return;
  }

  // save and redirect only if requirements are met
  saveCart();
  window.location.href = "/checkout.html";
});
function updateVariant(idx, variantObj) {
  if (!cart[idx]) return;
  cart[idx].variant_id = variantObj.id ?? cart[idx].variant_id;
  if (variantObj.price != null) cart[idx].price = variantObj.price;
  if (variantObj.image_url) cart[idx].image_url = variantObj.image_url;
  saveCart(cart);
  updateCartUI(); // refresh cart preview in store view
}

function saveCart(updatedCart = cart) {
  try {
    // Sync the global variable so functions like cartSummary() use fresh data
    cart = updatedCart; 
    
    // Save to disk
    localStorage.setItem("ub_cart", JSON.stringify(updatedCart));
    
    // Sync the checkout preview variable (if used)
    window.__UB_CART = updatedCart; 
    
    console.log('Cart Synced & Saved:', updatedCart);
  } catch (e) {
    console.warn("Failed to save cart to localStorage", e);
  }
}




// modal "Place Order" should also redirect to checkout page (preview only)
modalCheckout.addEventListener("click", () => {
  const cart = window.__UB_CART || [];

  // calculate totals
  const totalQty = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const totalPrice = cart.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 1)), 0);

  // enforce minimums: must have at least 5 items OR 600 Birr
  console.log('cart:', cart);
  console.log('Checkout clicked - totalQty:', totalQty, 'totalPrice:', totalPrice);
  if (totalQty < 5 && totalPrice < 600) {
    alert("⚠️ You need at least 5 items OR a total of 600 Birr to proceed to checkout.");
    // stay on the same page and refresh cart UI
    renderCartPreview();
    updateSummaryUI();
    return;
  }

  // save and redirect only if requirements are met
  saveCart();
  window.location.href = "/checkout.html";
});

/* ---------- Fetch ---------- */
async function fetchItems() {
  try {
    const res = await fetch(`${API}/asbeza/items`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('here is the dat recieved from the api', data)
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
    // When processing API data
    if (typeof item.variants === "string") {
      try {
        item.variants = JSON.parse(item.variants);
      } catch (e) {
        console.warn("Invalid variants JSON", e);
        item.variants = [];
      }
    }

    card.className = "rounded-2xl p-4 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/6 shadow-lg flex flex-col justify-between hover:scale-[1.01] transition-transform";

   card.innerHTML = `
    <div class="group relative flex flex-col bg-slate-900/40 rounded-[1.5rem] p-2 border border-white/5 hover:border-orange-500/30 transition-all duration-400">
        
       <div class="relative h-40 sm:h-44 w-full rounded-[1.2rem] overflow-hidden bg-slate-950 cursor-zoom-in"
onclick='UI.openPreview("${item.image_url}", "${escapeHtml(item.name)}", ${JSON.stringify(item.variants || [])}, ${item.id})'
>

    <!-- Variant count badge -->
    <div class="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-bold rounded-lg px-2 py-1 shadow-md">
      ${item.variants?.length || 0} options
    </div>

    <img 
        src="${item.image_url || ''}" 
        alt="${escapeHtml(item.name)}"
        class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    >
    
    <div class="hidden absolute inset-0 items-center justify-center bg-slate-800 text-white/5 font-black italic text-4xl">
        ${escapeHtml((item.name || "").slice(0,2).toUpperCase())}
    </div>

    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent opacity-40"></div>
</div>



        <div class="flex flex-col px-1 pt-3 pb-1">
            <h4 class="text-white font-bold text-[12px] sm:text-base leading-tight tracking-tight truncate mb-1">
                ${escapeHtml(item.name)}
            </h4>
            
            <div class="flex items-center gap-1.5 mb-3">
                <span class="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
                <span class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Available</span>
            </div>

            <div class="flex items-center justify-between gap-2 mt-auto border-t border-white/5 pt-3">
                <div class="flex flex-col">
                    <span class="text-orange-500 font-black text-sm leading-none">${formatPrice(price)}</span>
                    <span class="text-[8px] text-slate-600 uppercase font-bold tracking-tighter mt-1">Birr</span>
                </div>

                <button class="add-btn flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-orange-500 text-black hover:text-white transition-all duration-300 active:scale-90 shadow-lg"
                        >
                    <i class="fa-solid fa-plus text-[9px]"></i>
                    <span class="text-[8px] font-black uppercase tracking-widest">Add</span>
                </button>
            </div>
        </div>
    </div>
`;



    card.querySelector(".add-btn").addEventListener("click", () => {
  // If the API gives you a variants array, pick the first one as default
  const defaultVariant = (item.variants && item.variants.length)
    ? item.variants[0]
    : { id: item.id, price: item.base_price ?? item.price };

  addToCart(
    {
      id: item.id,
      name: item.name,
      description: item.description,
      variants: item.variants || [],
      image_url: item.image_url || null, // ✅ save image
    },
    defaultVariant // ✅ always pass a valid variant object
  );

  pulseCart();
});


    itemsContainer.appendChild(card);
  });
}



/* ---------- Cart logic (persist on every change) ---------- */
function addToCart(item, selectedVariant) {
  // If no variant provided, pick a default one
  let variant = selectedVariant;
  if (!variant || !variant.id || variant.price == null) {
    // fallback: use first variant if available, otherwise base item
    variant = (item.variants && item.variants.length)
      ? item.variants[0]
      : { id: item.id, price: item.base_price ?? item.price, image_url: item.image_url };
  }

  const variantId = variant.id;
  const variantPrice = variant.price;

  const existing = cart.find(c => c.variant_id === variantId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      description: item.description,
      variant_id: variantId,
      price: variantPrice,
      quantity: 1,
      image_url: variant.image_url || item.image_url || null, // ✅ store variant image if available
      variants: item.variants || []
    });
  }

  saveCart(cart);
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
  // summaryText.textContent = count ? `${count} item${count>1?'s':''} in cart` : "No items in cart";
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
        <div class="text-slate-400 text-sm">${escapeHtml((it.quantity||1) + ' × ' + (it.price || 0))}</div>
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
  refreshBtn.disabled = true; // Disable while loading to prevent spam
  refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate animate-spin"></i>';

  /* --- RESET FILTER STATE --- */
  UI.selectedCategories = []; // Clear the selection array
  
  // Remove orange active states from all pills
  document.querySelectorAll('.multi-cat-pill').forEach(pill => {
      pill.classList.remove('active-pill');
  });

  // Hide the orange notification dot on the filter toggle button
  const filterDot = document.getElementById('filterActiveDot');
  if (filterDot) filterDot.classList.add('hidden');

  // Clear out the live chips inside the overlay
  if (typeof UI.updateActiveFilters === "function") {
      UI.updateActiveFilters();
  }

  /* --- FETCH FRESH DATA --- */
  await init();

  refreshBtn.disabled = false;
  refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
});

searchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = lastItems.filter(i => (i.name || "").toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q));
  renderItems(filtered);
});

/* ---------- Init ---------- */
async function init() {
    // 1. Show Glass Skeletons immediately
    itemsContainer.innerHTML = Array(6).fill(0).map(() => `
        <div class="glass-ui rounded-[2rem] p-3 border border-white/5 animate-pulse">
            <div class="h-40 w-full bg-white/5 rounded-[1.5rem] mb-4"></div>
            <div class="px-2 space-y-3">
                <div class="h-4 w-2/3 bg-white/10 rounded-full"></div>
                <div class="h-2 w-1/3 bg-white/5 rounded-full"></div>
                <div class="flex justify-between items-center pt-4 border-t border-white/5">
                    <div class="h-6 w-16 bg-white/10 rounded-lg"></div>
                    <div class="h-8 w-20 bg-white/10 rounded-xl"></div>
                </div>
            </div>
        </div>
    `).join('');

    try {
        const items = await fetchItems();
        lastItems = items;
        
        // 2. Small delay to let the skeleton fade out smoothly
        setTimeout(() => {
            renderItems(items);
            updateCartUI();
        }, 300);
        
    } catch (error) {
        itemsContainer.innerHTML = `
            <div class="col-span-full text-center py-20">
                <p class="mono text-orange-500 uppercase text-xs">Sync_Error: Failed to reach server</p>
                <button onclick="init()" class="mt-4 px-6 py-2 bg-white/5 rounded-full text-[10px] text-white uppercase">Retry Sync</button>
            </div>
        `;
    }
}


function updateSummaryUI() {
    const { total, count } = cartSummary();
    const summaryPriceEl = document.getElementById("summaryPrice");
    const cartCountEl = document.getElementById("cartCount");
    
    if (summaryPriceEl) summaryPriceEl.textContent = formatPrice(total);
    if (cartCountEl) cartCountEl.textContent = String(count);
}
UI.switchView = function(viewId) {
    // 1. Save state for refresh persistence
    sessionStorage.setItem('last_view', viewId);

    // 2. Hide/Show Sections
    const sections = ['store', 'track', 'settings'];
    sections.forEach(id => {
        const el = document.getElementById(`view-${id}`);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block';
    }

    // 3. Update Button Styles (The Fix)
    sections.forEach(id => {
        const btn = document.getElementById(`tab-${id}`);
        if (!btn) return;

        if (id === viewId) {
            // Active State: Orange background, Black text
            btn.classList.add('bg-orange-500', 'text-black', 'shadow-lg', 'shadow-orange-500/20');
            btn.classList.remove('text-slate-500', 'hover:text-white', 'hover:bg-white/5');
        } else {
            // Inactive State: Gray text, transparent background
            btn.classList.remove('bg-orange-500', 'text-black', 'shadow-lg', 'shadow-orange-500/20');
            btn.classList.add('text-slate-500', 'hover:text-white', 'hover:bg-white/5');
        }
    });

    // 4. Global UI Logic
    const searchBar = document.getElementById('search-container');
    const checkoutBar = document.getElementById('checkout-bar');

    if (viewId === 'store') {
        searchBar?.classList.remove('hidden');
        checkoutBar?.classList.remove('hidden');
    } else {
        searchBar?.classList.add('hidden');
        checkoutBar?.classList.add('hidden');
        if (viewId === 'track') UI.loadUserOrders();
        if (viewId === 'settings') UI.loadProfile();
    }

    window.scrollTo(0, 0);
};

UI.loadUserOrders = async function() {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 1131741322; // Fallback for dev
    const container = document.getElementById('activeOrdersList');
    container.innerHTML = `
        <div class="animate-pulse space-y-4">
            <div class="h-32 bg-white/5 rounded-[2.5rem]"></div>
            <div class="h-32 bg-white/5 rounded-[2.5rem]"></div>
        </div>
    `;
    
    try {
        const res = await fetch(`${API}/asbeza/orders?user_id=${userId}`);
        const data = await res.json();
        
        console.log('here is the data passed', data)
        
        if (!data.orders || data.orders.length === 0) return;

        container.innerHTML = data.orders.map(order => {
            const statusMap = {
                'pending': { label: 'Awaiting Confirmation', color: 'text-yellow-500', icon: 'fa-spinner fa-spin', progress: '10%' },
                'processing': { label: 'Order Confirmed', color: 'text-blue-500', icon: 'fa-check-double', progress: '50%' },
                'shipped': { label: 'On the way', color: 'text-purple-500', icon: 'fa-box-archive', progress: '85%' },
                'completed': { label: 'Delivered', color: 'text-orange-500', icon: 'fa-truck-fast', progress: '100%' },
                'cancelled': { label: 'Order cancelled', color: 'text-green-500', icon: 'fa-house-circle-check', progress: '0%' }
            };
        
            const state = statusMap[order.status] || statusMap['pending'];

            return `
            <div class="glass-ui rounded-[2.5rem] p-6 border border-white/5 relative overflow-hidden group">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <span class="mono text-[10px] text-slate-500">ID: #UB-${order.id}</span>
                        <h3 class="text-xl font-black italic uppercase text-white ${state.color}">${state.label}</h3>
                    </div>
                    <i class="fa-solid ${state.icon} text-2xl ${state.color}"></i>
                </div>

                <div class="space-y-2">
                    <div class="flex justify-between mono text-[9px] text-slate-500 uppercase">
                        <span>Transmission Progress</span>
                        <span>${state.progress}</span>
                    </div>
                    <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-500 shadow-[0_0_15px_#ff7a00] transition-all duration-1000" style="width: ${state.progress}"></div>
                    </div>
                </div>

                <div class="mt-6 flex justify-between items-center border-t border-white/5 pt-4">
                    <div class="flex gap-4">
                        <div>
                            <p class="text-[8px] mono text-slate-500 uppercase">Load</p>
                            <p class="text-xs font-bold text-white">${order.item_count} Items</p>
                        </div>
                        <div>
                            <p class="text-[8px] mono text-slate-500 uppercase">Total</p>
                            <p class="text-xs font-bold text-white">${order.total_price} ETB</p>
                        </div>
                       
                    </div>
<button onclick='UI.showDetails(${JSON.stringify(order)})' class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl mono text-[9px] font-bold text-slate-300 transition-all active:scale-95">
    DETAILS
</button>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 mono text-center">Protocol Error: Unable to sync with server.</p>`;
    }
};
UI.showDetails = function(order) {
    const modal = document.getElementById('order-details-modal');
    
    // 1. Set ID and Calculations
    document.getElementById('modal-order-id').innerText = `ORD_TX: #UB-${order.id}`;
    
    const deliveryFee = order.delivery_fee || 0;
    const itemsPrice = order.total_price - deliveryFee;
    const upfront = order.upfront_paid || 0;
    const unpaid = order.total_price - upfront;

    document.getElementById('modal-items-price').innerText = `${itemsPrice.toLocaleString()} ETB`;
    document.getElementById('modal-delivery-fee').innerText = `${deliveryFee.toLocaleString()} ETB`;
    document.getElementById('modal-upfront').innerText = `-${upfront.toLocaleString()} ETB`;
    document.getElementById('modal-total').innerText = `${order.total_price.toLocaleString()} ETB`;
    document.getElementById('modal-unpaid').innerText = `${unpaid.toLocaleString()} ETB`;

    // 2. Courier Logic (Hide loader if Cancelled or Pending)
    const agentContainer = document.getElementById('modal-agent-info');
    const noCourierStatus = ['pending', 'cancelled'];
    
    if (order.delivery && order.delivery.name) {
        agentContainer.innerHTML = `
            <div class=" font-mono p-4 rounded-[2rem] bg-orange-500/10 border border-orange-500/20 flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-black font-black text-xl italic border-4 border-black/20">
                    ${order.delivery.name[0]}
                </div>
                <div class="flex-1">
                    <p class="text-[8px] mono text-orange-500 uppercase font-black mb-1">Assigned Agent</p>
                    <h4 class="text-sm font-black text-white uppercase">${order.delivery.name}</h4>
                    <p class="text-[9px] text-slate-500 mono uppercase">${order.delivery.campus} campus</p>
                </div>
                <a href="tel:${order.delivery.phone}" class="w-12 h-12 rounded-2xl bg-orange-500 text-black flex items-center justify-center shadow-lg active:scale-90 transition-all">
                    <i class="fa-solid fa-phone"></i>
                </a>
            </div>`;
    } else if (!noCourierStatus.includes(order.status.toLowerCase())) {
        // Only show searching if it's NOT pending/cancelled
        agentContainer.innerHTML = `
            <div class="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center gap-3 text-center">
                <div class="w-8 h-8 border-2 border-slate-700 border-t-orange-500 rounded-full animate-spin"></div>
                <p class="text-[9px] mono text-slate-500 uppercase tracking-widest">Searching for Delivery Guy...</p>
            </div>`;
    } else {
        // Show Status Badge instead
        agentContainer.innerHTML = `
            <div class="p-4 rounded-[2rem] bg-white/5 border border-white/5 flex items-center justify-center gap-3">
                <span class="text-[10px] mono text-slate-400 uppercase">System Status:</span>
                <span class="text-[10px] mono font-black text-orange-500 uppercase">${order.status}</span>
            </div>`;
    }

    // 3. Receipt Handling
    const imgElement = document.getElementById('modal-receipt-img');
    const receiptSection = document.getElementById('receipt-section');
    if (order.image_url) {
        imgElement.src = order.image_url;
        receiptSection.classList.remove('hidden');
    } else {
        receiptSection.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

// Open Image in New Tab / Full View
UI.viewFullReceipt = function() {
    const src = document.getElementById('modal-receipt-img').src;
    const zoomOverlay = document.getElementById('receipt-zoom-overlay');
    const zoomImg = document.getElementById('zoomed-receipt-img');

    if (!src || src === window.location.href) {
        console.error("Receipt source is empty or invalid");
        return;
    }

    // Set the image and show overlay
    zoomImg.src = src;
    zoomOverlay.classList.remove('hidden');
    zoomOverlay.classList.add('flex');

   
};

UI.closeReceiptZoom = function() {
    const zoomOverlay = document.getElementById('receipt-zoom-overlay');
    zoomOverlay.classList.add('hidden');
    zoomOverlay.classList.remove('flex');
};

UI.closeDetails = function() {
    const modal = document.getElementById('order-details-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
};

// Function to get a consistent random avatar for a user
UI.getAvatar = function(seed) {
    // 'adventurer' style looks high-end and fits your OS theme
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;

};


UI.loadProfile = async function() {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 1131741322;
    const profileContainer = document.getElementById('view-settings');

    try {
        const res = await fetch(`${API}/admin/users/${userId}`);
        const data = await res.json();

        if (data.status === 'ok') {
            const { user, summary } = data;
            
            // 1. Update Profile Header
            const nameEl = document.getElementById('userName');
            const avatarEl = document.getElementById('userAvatar');
            
            if(nameEl) nameEl.innerText = user.first_name || "Guest User";
            if(avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.id}`;
            
            // 2. Prepare Stats Grid
            const statsGrid = `
            <div class="grid grid-cols-3 gap-2 mb-6 px-2">
                <div class="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
                    <p class="text-[8px] mono text-slate-500 uppercase">Orders</p>
                    <p class="text-sm font-black text-white">${summary.total_orders}</p>
                </div>
                <div class="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
                    <p class="text-[8px] mono text-slate-500 uppercase">Level</p>
                    <p class="text-sm font-black text-orange-500">${user.level || 1}</p>
                </div>
                <div class="bg-white/5 rounded-2xl p-3 text-center border border-white/5">
                    <p class="text-[8px] mono text-slate-500 uppercase">Coins</p>
                    <p class="text-sm font-black text-yellow-400">${user.coins || 0}</p>
                </div>
            </div>`;

            // 3. Inject Stats safely
            const statsTarget = document.getElementById('stats-injection-point');
            if (statsTarget) {
                statsTarget.innerHTML = statsGrid;
            }
        }
    } catch (e) {
        console.error("Profile Load Failed", e);
    }
};

window.UI = window.UI || {};
// This runs automatically every time the page loads/refreshes
document.addEventListener('DOMContentLoaded', () => {
    // Check where they were, or default to 'store'
    const lastView = sessionStorage.getItem('last_view') || 'store';
    
    // Force the UI to that view
    UI.switchView(lastView);
});
init();


