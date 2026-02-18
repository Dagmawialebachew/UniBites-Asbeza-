// checkout.js (ES module) — reads persisted cart, allows edits, places order with delivery fee
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:8000/api"
    : "https://deliveraau.onrender.com/api";
const STORAGE_KEY = "ub_cart";

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const formatPrice = (v) => `${Number(v).toLocaleString()} birr`;
const escapeHtml = (s) => String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to load cart", e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.warn("Failed to save cart", e);
  }
}

/* ---------- Delivery fee rule ---------- */
function computeDeliveryFee(subtotal) {
  const base = 80; // fixed start
  if (subtotal >= 500) {
    // add 3% of subtotal on top of base
    return base + Math.round(subtotal * 0.01);
  }
  return base;
}

/* ---------- DOM refs ---------- */
const checkoutItems = $("#checkoutItems");
const subtotalEl = $("#subtotal");
const deliveryFeeEl = $("#deliveryFee");
const upfrontEl = $("#upfront");
const totalEl = $("#total");
const placeOrderBtn = $("#placeOrderBtn");
const continueBtn = $("#continueBtn");
const emptyNotice = $("#emptyNotice");
const successOverlay = $("#successOverlay");
const successTitle = $("#successTitle");
const successText = $("#successText");
const successMeta = $("#successMeta");
const successClose = $("#successClose");

let cart = loadCart();

/* ---------- Render ---------- */
function renderCheckout() {
  checkoutItems.innerHTML = "";
  if (!cart.length) {
    emptyNotice.classList.remove("hidden");
    subtotalEl.textContent = "0 birr";
    deliveryFeeEl.textContent = "0 birr";
    upfrontEl.textContent = "0 birr";
    totalEl.textContent = "0 birr";
    placeOrderBtn.disabled = true;
    return;
  }
  emptyNotice.classList.add("hidden");
  placeOrderBtn.disabled = false;

  let subtotal = 0;

  cart.forEach((item, idx) => {
    const qty = item.quantity || 1;
    const price = Number(item.price || 0);
    subtotal += price * qty;

    const card = document.createElement("div");
    card.className = "rounded-xl bg-slate-800/60 p-4 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4";

    const variantHtml = (item.variants && Array.isArray(item.variants))
  ? `<div class="mt-3 relative">
       <select data-idx="${idx}" class="variant-select w-full bg-white/5 border border-white/10 text-slate-300 text-[10px] mono uppercase rounded-xl px-3 py-2 outline-none focus:border-orange-500/50 transition-all appearance-none">
         ${item.variants.map(v => `
           <option value="${escapeHtml(JSON.stringify(v))}" ${v.id === item.variant_id ? "selected" : ""}>
             ${escapeHtml(v.name)} — ${formatPrice(v.price)}
           </option>`).join("")}
       </select>
       <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[8px]">
         <i class="fa-solid fa-chevron-down"></i>
       </div>
     </div>`
  : "";

card.className = "glass-ui rounded-[2rem] p-4 sm:p-6 border-t-white/10 flex flex-col sm:flex-row gap-6 items-center justify-between transition-all";

card.innerHTML = `
  <div class="flex items-start gap-4 w-full sm:w-auto">
    <div class="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-xl font-black italic shadow-glow"
         style="background: linear-gradient(135deg, var(--brand-grad-1), var(--brand-grad-2));">
      ${escapeHtml((item.name || "").slice(0,2).toUpperCase())}
    </div>
    
    <div class="flex-1">
      <div class="font-black uppercase italic tracking-tighter text-white text-md leading-none">${escapeHtml(item.name)}</div>
      <div class="text-slate-500 text-[10px] mono uppercase tracking-widest mt-1 line-clamp-1">${escapeHtml(item.description || "Essential Item")}</div>
      
      <div class="flex items-center gap-3 mt-2">
        <span class="text-[10px] mono text-slate-400 uppercase tracking-tighter">Unit:</span>
        <span class="text-xs font-bold text-orange-400">${formatPrice(price)}</span>
      </div>
      
      ${variantHtml}
    </div>
  </div>

  <div class="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t border-white/5 sm:border-none pt-4 sm:pt-0">
    <div class="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
      <button data-action="dec" data-idx="${idx}" 
              class="w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90 flex items-center justify-center">
        <i class="fa-solid fa-minus text-[10px]"></i>
      </button>
      
      <div class="px-4 text-sm font-black mono text-white">${qty}</div>
      
      <button data-action="inc" data-idx="${idx}" 
              class="w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90 flex items-center justify-center">
        <i class="fa-solid fa-plus text-[10px]"></i>
      </button>
    </div>

    <div class="text-right min-w-[100px]">
      <div class="text-lg font-black text-white italic tracking-tighter">${formatPrice(price * qty)}</div>
      <button data-action="remove" data-idx="${idx}" 
              class="text-[9px] mono uppercase text-rose-500/70 hover:text-rose-400 tracking-widest mt-1 transition-colors">
        <i class="fa-solid fa-trash-can mr-1"></i> Remove
      </button>
    </div>
  </div>
`;

checkoutItems.appendChild(card);
  });

  // compute delivery fee and totals
  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4); // upfront on total (subtotal + deliveryFee)

  subtotalEl.textContent = formatPrice(subtotal);
  deliveryFeeEl.textContent = formatPrice(deliveryFee);
  upfrontEl.textContent = formatPrice(upfront);
  totalEl.textContent = formatPrice(total);
}

/* ---------- Item actions ---------- */
function changeQty(idx, delta) {
  if (!cart[idx]) return;
  cart[idx].quantity = Math.max(1, (cart[idx].quantity || 1) + delta);
  saveCart(cart);
  renderCheckout();
}

function removeItem(idx) {
  if (!cart[idx]) return;
  cart.splice(idx, 1);
  saveCart(cart);
  renderCheckout();
}

function updateVariant(idx, variantObj) {
  if (!cart[idx]) return;
  cart[idx].variant_id = variantObj.id ?? cart[idx].variant_id;
  if (variantObj.price != null) cart[idx].price = variantObj.price;
  saveCart(cart);
  renderCheckout();
}

/* ---------- Event delegation ---------- */
checkoutItems.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const action = btn.dataset.action;
  if (action === "inc") changeQty(idx, 1);
  if (action === "dec") changeQty(idx, -1);
  if (action === "remove") removeItem(idx);
});

checkoutItems.addEventListener("change", (e) => {
  const sel = e.target.closest("select.variant-select");
  if (!sel) return;
  const idx = Number(sel.dataset.idx);
  try {
    const parsed = JSON.parse(sel.value);
    updateVariant(idx, parsed);
  } catch (err) {
    console.warn("Invalid variant value", err);
  }
});

/* ---------- Place order (includes delivery_fee and total_price in payload) ---------- */
/*
  NOTE
  - The payment modal (part 2) will call submitCheckoutWithProof(...) or call placeOrder(payloadWithProof).
  - Here we keep placeOrder() as the raw API caller (no proof). The modal should call a wrapper that includes proof fields.
*/
async function placeOrder(payloadOverride = null) {
  if (!cart.length) {
    toast("Your cart is empty", { type: "error" });
    return;
  }

  // recompute totals to be safe
  const subtotal = cart.reduce((s, it) => s + (Number(it.price || 0) * (it.quantity || 1)), 0);
  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4);

  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id ?? null;

  // base payload
  const basePayload = {
    user_id: userId,
    items: cart.map(i => ({
      variant_id: i.variant_id ?? null,
      quantity: i.quantity ?? 1,
      price: i.price
    })),
    delivery_fee: deliveryFee,
    total_price: total,
    upfront_paid: upfront
  };

  // allow modal to pass additional fields (payment_proof_url / payment_proof_base64)
  const payload = payloadOverride ? { ...basePayload, ...payloadOverride } : basePayload;
  console.log("Checkout payload", payload);

  placeOrderBtn.disabled = true;
  const originalText = placeOrderBtn.textContent;
  placeOrderBtn.innerHTML = `<svg class="animate-spin w-4 h-4 inline-block mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" fill="none"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg> Placing...`;

  try {
    const res = await fetch(`${API}/asbeza/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server ${res.status}: ${text}`);
    }

    const body = await res.json();
    if (body.status !== "ok") throw new Error(body.message || "Unknown error");

    successTitle.textContent = "Order awaiting confirmation";
    successText.textContent = `Order #${body.order_id} received. We will notify you via Telegram once it's confirmed.`;
    successMeta.textContent = `Total: ${formatPrice(total)} • Delivery: ${formatPrice(deliveryFee)} • Upfront: ${formatPrice(upfront)}`;
    successOverlay.classList.remove("hidden");
    successOverlay.classList.add("flex");

    // clear cart
    cart = [];
    saveCart(cart);
    renderCheckout();

    setTimeout(() => {
      if (tg) tg.close();
    }, 1400);

    return body;
  } catch (err) {
    console.error("Checkout failed", err);
    toast("Checkout failed. Try again.", { type: "error" });
    throw err;
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = originalText;
  }
}

/* ---------- Toast helper ---------- */
function toast(message, { type = "info", duration = 3500 } = {}) {
  const el = document.createElement("div");
  el.className = `fixed right-6 top-6 z-50 px-4 py-2 rounded-lg text-sm ${type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-slate-700"} text-white shadow-lg`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ---------- Wire UI ---------- */
/*
  Instead of binding placeOrder directly to the button, open the payment modal.
  The modal (part 2) must implement openPaymentModal(upfront) and call placeOrder(payloadWithProof)
  when the user confirms upload.
*/
placeOrderBtn.addEventListener("click", () => {
  // compute upfront and open modal; modal will handle upload and then call placeOrder({...proof...})
  const subtotal = cart.reduce((s, it) => s + (Number(it.price || 0) * (it.quantity || 1)), 0);
  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4);

  // placeholder: openPaymentModal should be provided in part 2
  if (typeof openPaymentModal === "function") {
    openPaymentModal(upfront);
  } else {
    // fallback: if modal not present, call placeOrder without proof (not recommended)
    toast("Payment modal not available. Submitting order without proof.", { type: "error" });
    placeOrder(); // will call API without proof
  }
});

continueBtn.addEventListener("click", () => { window.location.href = "/"; });
successClose.addEventListener("click", () => {
  successOverlay.classList.add("hidden");
  successOverlay.classList.remove("flex");
});

/* ---------- Init ---------- */
renderCheckout();



// Payment modal integration (part 2) for checkout.js
// Assumes existing helpers and variables: API, formatPrice, computeDeliveryFee, cart, saveCart, renderCheckout, toast, placeOrder

// Use API-based upload endpoint
const uploadUrl = `${API}/asbeza/upload_screenshot`;

// DOM refs for payment modal
const paymentModal = document.getElementById("paymentModal");
const paymentBackdrop = document.getElementById("paymentBackdrop");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const paymentFileInput = document.getElementById("paymentFile");
const fileNameEl = document.getElementById("fileName");
const previewWrap = document.getElementById("previewWrap");
const paymentPreview = document.getElementById("paymentPreview");
const removeFileBtn = document.getElementById("removeFileBtn");
const replaceFileBtn = document.getElementById("replaceFileBtn");
const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");
const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
const paymentError = document.getElementById("paymentError");
const upfrontAmountEl = document.getElementById("upfrontAmount");

// Optional instruction/confirmation blocks (must exist in HTML)
const paymentInstructions = document.getElementById("paymentInstructions");
const paymentUploadedWrap = document.getElementById("paymentUploaded");
const uploadedThumb = document.getElementById("uploadedThumb");
const uploadedMsg = document.getElementById("uploadedMsg");

// internal state for selected file
let selectedFile = null;

// helper: normalize relative URLs returned by server
function normalizeUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${location.origin}${url}`;
}

// helper to open modal and set upfront amount
function openPaymentModal(upfrontAmount) {
  upfrontAmountEl.textContent = formatPrice(upfrontAmount);
  paymentError.classList.add("hidden");
  fileNameEl.textContent = "No file chosen";
  previewWrap.classList.add("hidden");
  paymentPreview.src = "";
  selectedFile = null;
  confirmPaymentBtn.disabled = true;

  // reset instructions / uploaded UI
  if (paymentInstructions) paymentInstructions.classList.remove("hidden");
  if (paymentUploadedWrap) paymentUploadedWrap.classList.add("hidden");
  chooseFileBtn.disabled = false;
  removeFileBtn.disabled = false;
  replaceFileBtn.disabled = false;

  paymentModal.classList.remove("hidden");
  paymentModal.classList.add("flex");
}

// close modal
function closePaymentModal() {
  paymentModal.classList.add("hidden");
  paymentModal.classList.remove("flex");
}

// wire choose file button
chooseFileBtn.addEventListener("click", () => paymentFileInput.click());
paymentFileInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  // basic validation: image and size limit (6MB)
  if (!f.type.startsWith("image/")) {
    paymentError.textContent = "Please select an image file.";
    paymentError.classList.remove("hidden");
    return;
  }
  const maxBytes = 6 * 1024 * 1024;
  if (f.size > maxBytes) {
    paymentError.textContent = "Image too large. Max 6 MB.";
    paymentError.classList.remove("hidden");
    return;
  }
  paymentError.classList.add("hidden");
  selectedFile = f;
  fileNameEl.textContent = f.name;

  // preview (constrained by CSS)
  const reader = new FileReader();
  reader.onload = (ev) => {
    paymentPreview.src = ev.target.result;
    paymentPreview.style.maxHeight = "320px";
    paymentPreview.style.objectFit = "contain";
    previewWrap.classList.remove("hidden");
  };
  reader.readAsDataURL(f);
  confirmPaymentBtn.disabled = false;
});

// remove/replace handlers
removeFileBtn.addEventListener("click", () => {
  paymentFileInput.value = "";
  selectedFile = null;
  previewWrap.classList.add("hidden");
  fileNameEl.textContent = "No file chosen";
  confirmPaymentBtn.disabled = true;
});
replaceFileBtn.addEventListener("click", () => paymentFileInput.click());
cancelPaymentBtn.addEventListener("click", () => {
  // allow cancel only when not uploading
  if (!confirmPaymentBtn.disabled) closePaymentModal();
});

// prevent accidental close while uploading; allow close when not uploading
paymentBackdrop.addEventListener("click", () => {
  if (!confirmPaymentBtn.disabled) closePaymentModal();
});

// allow Esc to close modal when not uploading
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !confirmPaymentBtn.disabled) closePaymentModal();
});

// When user clicks Place Order, open modal instead of directly placing order
// Ensure placeOrderBtn opens modal (part 1 binds this)
placeOrderBtn.addEventListener("click", () => {
  const subtotal = cart.reduce((s, it) => s + (Number(it.price || 0) * (it.quantity || 1)), 0);
  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4);
  openPaymentModal(upfront);
});

// show uploaded confirmation inside the modal and hide the payment instructions
function showUploadedConfirmation(publicUrl) {
  if (!paymentUploadedWrap || !uploadedThumb || !uploadedMsg) return;
  const normalized = normalizeUrl(publicUrl);
  uploadedThumb.src = normalized;
  uploadedMsg.textContent = "Uploaded — awaiting admin confirmation. We'll notify you via Telegram.";
  if (paymentInstructions) paymentInstructions.classList.add("hidden");
  paymentUploadedWrap.classList.remove("hidden");

  // disable file controls to prevent re-uploads
  chooseFileBtn.disabled = true;
  removeFileBtn.disabled = true;
  replaceFileBtn.disabled = true;
  confirmPaymentBtn.disabled = true;
  cancelPaymentBtn.disabled = false;
}

// confirmPaymentBtn uploads screenshot then calls checkout with proof
confirmPaymentBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    paymentError.textContent = "Please choose a screenshot to continue.";
    paymentError.classList.remove("hidden");
    return;
  }

  confirmPaymentBtn.disabled = true;
  const originalText = confirmPaymentBtn.textContent;
  confirmPaymentBtn.innerHTML = `<svg class="animate-spin w-4 h-4 inline-block mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" fill="none"/></svg> Uploading...`;

  try {
    // 1) Try to upload file to dedicated endpoint
    let screenshotUrl = null;
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const uploadRes = await fetch(uploadUrl, { method: "POST", body: fd });
      if (uploadRes.ok) {
        const uploadBody = await uploadRes.json();
        if (uploadBody && uploadBody.url) {
          screenshotUrl = uploadBody.url;
          if (screenshotUrl.startsWith("/")) screenshotUrl = `${location.origin}${screenshotUrl}`;
        }
      } else {
        console.warn("Upload endpoint returned", uploadRes.status);
      }
    } catch (err) {
      console.warn("Upload endpoint failed, will fallback to base64", err);
    }

    // 2) If upload failed, fallback to base64 embed
    let base64Data = null;
    if (!screenshotUrl) {
      base64Data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(selectedFile);
      });
    }

    // 3) Now call checkout endpoint with payment proof
    const subtotal = cart.reduce((s, it) => s + (Number(it.price || 0) * (it.quantity || 1)), 0);
    const deliveryFee = computeDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;
    const upfront = Math.floor(total * 0.4);

    const tg = window.Telegram?.WebApp;
    const userId = tg?.initDataUnsafe?.user?.id ?? null;

    const payload = {
      user_id: userId,
      items: cart.map(i => ({
        variant_id: i.variant_id ?? null,
        quantity: i.quantity ?? 1,
        price: i.price
      })),
    
      payment_proof_url: screenshotUrl || null,
      payment_proof_base64: screenshotUrl ? null : base64Data
    };
    console.log("Checkout payload with proof", payload);

    const res = await fetch(`${API}/asbeza/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.status !== "ok") {
      throw new Error(body?.message || `Server ${res?.status || "error"}`);
    }

    // show uploaded confirmation inside modal (prefer server-returned proof URL if available)
    const finalProofUrl = screenshotUrl || body.payment_proof_url || null;
    if (finalProofUrl) showUploadedConfirmation(finalProofUrl);

    // global success overlay
    successTitle.textContent = "Order awaiting confirmation";
    successText.textContent = `Order #${body.order_id} is awaiting confirmation. We'll notify you via Telegram when it's confirmed.`;
    successMeta.textContent = `Upfront: ${formatPrice(upfront)} • Delivery: ${formatPrice(deliveryFee)}`;
    successOverlay.classList.remove("hidden");
    successOverlay.classList.add("flex");

    // clear cart and update UI
    cart = [];
    saveCart(cart);
    renderCheckout();

    // close modal after short delay so user sees confirmation
    setTimeout(() => {
      closePaymentModal();
      if (tg) tg.close();
    }, 900);

    return body;
  } catch (err) {
    console.error("Payment upload / checkout failed", err);
    paymentError.textContent = err?.message || "Upload or checkout failed. Try again.";
    paymentError.classList.remove("hidden");
    toast("Upload failed. Try again.", { type: "error" });
    throw err;
  } finally {
    confirmPaymentBtn.disabled = false;
    confirmPaymentBtn.textContent = originalText;
  }
});
