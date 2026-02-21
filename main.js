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

const telegramUserId = getQueryParam("user_id");

if (telegramUserId) {
  localStorage.setItem("ub_user_id", telegramUserId);
  console.log("User ID from query:", telegramUserId);
} else {
  console.log("No user_id found in query params");
}


/* ---------- UI Preview Logic ---------- */
const UI = {
  openPreview(url, name, variants = [], productId = null) {
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('previewFullImg');
  const title = document.getElementById('previewTitle');
  const variantBox = document.getElementById('previewVariants');

  if (!url || url === 'undefined') return;

  // Load fresh cart from storage
  
  // Find cart entry by product id (NOT by array index)
         let currentCart = loadCart();

  const itemInCart = productId != null ? currentCart.find(c => c.id === productId) : undefined;

  // Determine active variant: prefer saved cart choice, otherwise none (so nothing is pre-checked for empty cart)
  const currentSelectedId = itemInCart?.variant_id ?? null;

  // Set initial image (use selected variant image if present)
  const initialVariant = variants.find(v => v.id === currentSelectedId);
  img.src = (initialVariant && initialVariant.image_url) ? initialVariant.image_url : url;
  title.textContent = name;

  // Render variants (no pre-check if cart has no entry)
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

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Attach click handlers for variant buttons
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
        circle.className = `w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isThis ? 'border-orange-500 bg-orange-500' : 'border-white/20 bg-transparent'}`;
        circle.innerHTML = isThis ? '<i class="fa-solid fa-check text-black text-[10px]"></i>' : '';
      });

      // Persist selection by product id (add if missing, update if exists)
  let entry = currentCart.find(c => c.id === pid);
  if (!entry) {
    // If item isn't in cart yet, add it
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
    // If item exists, update the specific entry
    entry.variant_id = vId;
    entry.price = vPrice;
    entry.image_url = vImage;
}
cart = currentCart

// Save to localStorage
saveCart(cart); 
updateCartUI(); 
if (typeof renderCartPreview === "function") renderCartPreview();
if (typeof updateSummaryUI === "function") updateSummaryUI();
updateSummaryUI();

      
      img.src = vImage || url;

      // Optional global hook (keeps other modules in sync)
      if (typeof updateVariant === "function") {
        updateVariant(pid, { id: vId, name: vName, price: vPrice, image_url: vImage });
      }

// Refresh cart UI immediately
      
     

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
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Unlock scroll
    }

    
};

// Also expose closePreview to the window so the HTML 'onclick' can find it
window.UI = UI;


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
            <h4 class="text-white font-bold text-sm sm:text-base leading-tight uppercase tracking-tight truncate mb-1">
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
                    <span class="text-[10px] font-black uppercase tracking-widest">Add</span>
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


function updateSummaryUI() {
    const { total, count } = cartSummary();
    const summaryPriceEl = document.getElementById("summaryPrice");
    const cartCountEl = document.getElementById("cartCount");
    
    if (summaryPriceEl) summaryPriceEl.textContent = formatPrice(total);
    if (cartCountEl) cartCountEl.textContent = String(count);
}


UI.switchView = function(viewId) {
    // 1. SAVE STATE
    sessionStorage.setItem('last_view', viewId);

    // 2. Identify the "Global" UI elements exactly
    const searchBar = document.getElementById('search-container'); 
    const checkoutBar = document.getElementById('checkout-bar');
    // const categoryFilters = document.getElementById('category-filters');

    // 3. SAFE HAPTICS
    if (window.Telegram?.WebApp?.isVersionAtLeast('6.1')) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    // 4. Section Toggling
    const sections = ['store', 'track', 'settings'];
    sections.forEach(id => {
        const el = document.getElementById(`view-${id}`);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-in', 'fade-in');
    }

    // 5. THE HIDE LOGIC (Aggressive)
    if (viewId === 'store') {
        // Show everything for shopping
        if(searchBar) searchBar.classList.remove('hidden');
        if(checkoutBar) checkoutBar.classList.remove('hidden');
        // if(categoryFilters) categoryFilters.classList.remove('hidden');
    } else {
        // Hide everything for a clean Track/Profile page
        if(searchBar) searchBar.classList.add('hidden');
        if(checkoutBar) checkoutBar.classList.add('hidden');
        // if(categoryFilters) categoryFilters.classList.add('hidden');
        
        if (viewId === 'track') UI.loadUserOrders();
    }

    // 6. Navigation Visuals
    document.querySelectorAll('.nav-item').forEach(btn => {
        const isCurrent = btn.getAttribute('onclick').includes(viewId);
        btn.classList.toggle('text-orange-500', isCurrent);
        btn.classList.toggle('text-slate-500', !isCurrent);
    });
};

UI.loadUserOrders = async function() {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 12345; // Fallback for dev
    const container = document.getElementById('activeOrdersList');
    
    try {
        const res = await fetch(`${API}/asbeza/orders?user_id=${userId}`);
        const data = await res.json();
        
        if (!data.orders || data.orders.length === 0) return;

        container.innerHTML = data.orders.map(order => {
            const statusMap = {
                'pending': { label: 'Awaiting Confirmation', color: 'text-yellow-500', icon: 'fa-spinner fa-spin', progress: '15%' },
                'confirmed': { label: 'Order Confirmed', color: 'text-blue-500', icon: 'fa-check-double', progress: '40%' },
                'processing': { label: 'Packaging Items', color: 'text-purple-500', icon: 'fa-box-archive', progress: '65%' },
                'in_transit': { label: 'Courier Dispatched', color: 'text-orange-500', icon: 'fa-truck-fast', progress: '85%' },
                'delivered': { label: 'Deployment Successful', color: 'text-green-500', icon: 'fa-house-circle-check', progress: '100%' }
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
                    <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl mono text-[9px] font-bold text-slate-300">DETAILS</button>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 mono text-center">Protocol Error: Unable to sync with server.</p>`;
    }
};
window.UI = window.UI || {};

init();


