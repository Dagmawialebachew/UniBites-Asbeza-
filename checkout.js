// checkout.js (ES module) — reads persisted cart, allows edits, places order with delivery fee
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:8000/api"
    : "https://deliveraau.onrender.com/api";
const STORAGE_KEY = "ub_cart";

/* ---------- Helpers ---------- */
const $ = (s) => document.querySelector(s);
const formatPrice = (v) => `${Number(v).toLocaleString()} birr`;
const escapeHtml = (s) =>
  String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

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
    console.log("here is our new way cart happening because of variants", cart);
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
    const zero = formatPrice(0);
    subtotalEl.textContent = zero;
    deliveryFeeEl.textContent = zero;
    upfrontEl.textContent = zero;
    totalEl.textContent = zero;
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

    // Find the currently selected variant object to display its name
    const currentVariant = item.variants?.find((v) => v.id === item.variant_id);

    const card = document.createElement("div");
    card.className =
      "glass-ui rounded-[2rem] p-5 border-t border-white/10 flex flex-col gap-5 transition-all hover:bg-white/[0.02]";

    // Redesigned Variant Selection: Premium "pill" selector
    const variantHtml =
      item.variants && Array.isArray(item.variants)
        ? `<div class="mt-2">
           <div class="flex items-center justify-between px-1 mb-2">
             <label class="text-[8px] mono text-slate-500 uppercase tracking-[0.2em]">Selected Variant</label>
             <span class="text-[9px] font-black text-orange-500 uppercase italic tracking-tighter">
               ${currentVariant ? escapeHtml(currentVariant.name) : "Standard"}
             </span>
           </div>
           <div class="relative group">
             <select data-idx="${idx}" class="variant-select w-full bg-white/5 border border-white/5 text-slate-200 text-[11px] font-bold uppercase rounded-2xl px-4 py-3 outline-none focus:border-orange-500/40 transition-all appearance-none cursor-pointer group-hover:bg-white/10">
               ${item.variants
                 .map(
                   (v) => `
                 <option value='${JSON.stringify(v)}' ${v.id === item.variant_id ? "selected" : ""}>
  ${escapeHtml(v.name)} — ${formatPrice(v.price)}
</option>
`,
                 )
                 .join("")}
             </select>
             <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-orange-500 transition-colors">
               <i class="fa-solid fa-chevron-down text-[8px]"></i>
             </div>
           </div>
         </div>`
        : "";

    card.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-slate-900/40 border border-white/5 relative shadow-inner">
            <img 
              src="${item.image_url || ""}" 
              alt="${escapeHtml(item.name)}"
class="w-full h-full object-cover transition-opacity duration-300"              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >
            <div class="hidden absolute inset-0 items-center justify-center bg-slate-800 text-white/10 font-black italic text-xl uppercase">
              ${escapeHtml((item.name || "").slice(0, 2))}
            </div>
          </div>

          <div class="min-w-0">
            <div class="font-black uppercase italic tracking-tighter text-white text-md leading-none truncate">${escapeHtml(item.name)}</div>
            <div class="flex items-center gap-2 mt-1">
               <span class="text-orange-500 text-[10px] font-black mono">${formatPrice(price)}</span>
               <span class="w-1 h-1 rounded-full bg-white/10"></span>
               <span class="text-slate-600 text-[9px] uppercase font-bold tracking-widest">per unit</span>
            </div>
          </div>
        </div>

        <button data-action="remove" data-idx="${idx}" 
                class="w-10 h-10 rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90 flex items-center justify-center">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>

      ${variantHtml}

      <div class="flex items-center justify-between bg-black/40 rounded-[1.5rem] p-1.5 border border-white/5 shadow-xl">
        <div class="flex items-center bg-white/5 rounded-xl p-1">
          <button data-action="dec" data-idx="${idx}" 
                  class="w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-75 flex items-center justify-center">
            <i class="fa-solid fa-minus text-[8px]"></i>
          </button>
          
          <div class="px-4 text-xs font-black mono text-white">${qty}</div>
          
          <button data-action="inc" data-idx="${idx}" 
                  class="w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-75 flex items-center justify-center">
            <i class="fa-solid fa-plus text-[8px]"></i>
          </button>
        </div>

        <div class="pr-4 text-right">
          <div class="text-[7px] mono text-slate-600 uppercase tracking-[0.2em] leading-none mb-1">Item Total</div>
          <div class="text-md font-black text-white italic tracking-tighter uppercase">${formatPrice(price * qty)}</div>
        </div>
      </div>
    `;

    checkoutItems.appendChild(card);
  });

  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4);

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

  // 1. Update variant ID and price
  cart[idx].variant_id = variantObj.id ?? cart[idx].variant_id;
  if (variantObj.price != null) cart[idx].price = variantObj.price;

  // 2. IMPORTANT: Update the image_url to the variant's image
  // Fallback to the original item image if the variant doesn't have one
  if (variantObj.image_url) {
    cart[idx].image_url = variantObj.image_url;
  }

  // 3. Save and re-render
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

// This existing listener in your code works perfectly with the fix above:
checkoutItems.addEventListener("change", (e) => {
  const sel = e.target.closest("select.variant-select");
  if (!sel) return;
  const idx = Number(sel.dataset.idx);
  try {
    const parsed = JSON.parse(sel.value); // parsed contains .image_url
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
  const subtotal = cart.reduce(
    (s, it) => s + Number(it.price || 0) * (it.quantity || 1),
    0,
  );
  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4);

  const tg = window.Telegram?.WebApp;
  const userIdRaw =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id ??
    localStorage.getItem("ub_user_id") ??
    null;
  const userId = userIdRaw ? parseInt(userIdRaw, 10) : null;

  // base payload
  const basePayload = {
    user_id: userId,
    items: cart.map((i) => ({
      variant_id: i.variant_id ?? null,
      quantity: i.quantity ?? 1,
      price: i.price,
    })),
    delivery_fee: deliveryFee,
    total_price: total,
    upfront_paid: upfront,
  };

  // allow modal to pass additional fields (payment_proof_url / payment_proof_base64)
  const payload = payloadOverride
    ? { ...basePayload, ...payloadOverride }
    : basePayload;
  console.log("Checkout payload", payload);

  placeOrderBtn.disabled = true;
  const originalText = placeOrderBtn.textContent;
  placeOrderBtn.innerHTML = `<svg class="animate-spin w-4 h-4 inline-block mr-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" fill="none"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg> Placing...`;

  try {
    const res = await fetch(`${API}/asbeza/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  const cart = loadCart(); // instead of window.__UB_CART
  console.log("here is the cart", cart);

  const subtotal = cart.reduce(
    (s, it) => s + Number(it.price || 0) * (it.quantity || 1),
    0
  );
  const deliveryFee = computeDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const upfront = Math.floor(total * 0.4);

  const totalQty = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
  console.log("Total quantity:", totalQty, "Subtotal:", subtotal);

  if (totalQty < 5 && subtotal < 600) {
    alert("⚠️ You need at least 5 items OR a total of 600 Birr to place an order.");
    return;
  }

  if (typeof openPaymentModal === "function") {
    openPaymentModal(upfront);
  } else {
    toast("Payment modal not available. Submitting order without proof.", {
      type: "error",
    });
    placeOrder();
  }
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
    cancelPaymentBtn.disabled = false;
    cancelPaymentBtn.addEventListener("click", () => {
  // allow cancel only when not uploading
  closePaymentModal();
});


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
// placeOrderBtn.addEventListener("click", () => {
//   const subtotal = cart.reduce(
//     (s, it) => s + Number(it.price || 0) * (it.quantity || 1),
//     0,
//   );
//   const deliveryFee = computeDeliveryFee(subtotal);
//   const total = subtotal + deliveryFee;
//   const upfront = Math.floor(total * 0.4);
//   openPaymentModal(upfront);
// });

// show uploaded confirmation inside the modal and hide the payment instructions
function showUploadedConfirmation(publicUrl) {
  if (!paymentUploadedWrap || !uploadedThumb || !uploadedMsg) return;
  const normalized = normalizeUrl(publicUrl);
  uploadedThumb.src = normalized;
  uploadedMsg.textContent =
    "Uploaded — awaiting admin confirmation. We'll notify you via Telegram.";
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
  // --- Guards ---
  if (!selectedFile) {
    paymentError.textContent = "Please choose a screenshot to continue.";
    paymentError.classList.remove("hidden");
    return;
  }

  // --- DOM refs ---
  const progressWrap = document.getElementById("uploadProgressWrap");
  const progressBar = document.getElementById("uploadProgressBar");
  const percentText = document.getElementById("uploadPercent");
  const statusText = document.getElementById("uploadStatusText");
  const abortBtn = document.getElementById("abortUploadBtn");

  // create or reuse a retry button inside progressWrap
  let retryBtn = document.getElementById("retryUploadBtn");
  if (!retryBtn && progressWrap) {
    retryBtn = document.createElement("button");
    retryBtn.id = "retryUploadBtn";
    retryBtn.className =
      "mt-4 w-full py-2 rounded-lg bg-green-500/10 text-green-500 text-[9px] mono uppercase tracking-widest hover:bg-green-500/20 transition-all border border-green-500/10 hidden";
    retryBtn.textContent = "Retry Upload";
    progressWrap.appendChild(retryBtn);
  }

  // save original button state
  const originalBtnHtml = confirmPaymentBtn.innerHTML;

  // helpers to update UI safely
  const setStatus = (txt) => { if (statusText) statusText.innerText = txt; };
  const setPercent = (n) => {
    if (progressBar) progressBar.style.width = `${n}%`;
    if (percentText) percentText.innerText = `${n}%`;
  };
  const setProgressColor = (color) => {
    if (!progressBar) return;
    // color can be 'normal' or 'error'
    if (color === "error") {
      progressBar.style.background = "linear-gradient(90deg,#ef4444,#f97316)"; // red/orange
      progressBar.style.boxShadow = "0 0 10px rgba(239,68,68,0.35)";
    } else {
      progressBar.style.background = "linear-gradient(90deg,#f97316,#fb923c)"; // original orange
      progressBar.style.boxShadow = "0 0 10px rgba(249,115,22,0.3)";
    }
  };

  // disable primary UI
  confirmPaymentBtn.disabled = true;
  confirmPaymentBtn.classList.add("opacity-50", "pointer-events-none");
  if (progressWrap) progressWrap.classList.remove("hidden");
  setStatus("Preparing upload...");
  setPercent(0);
  setProgressColor("normal");
  paymentError.classList.add("hidden");

  // XHR controller for aborting
  let currentXhr = null;
  let abortedByUser = false;
  const abortUpload = () => {
    abortedByUser = true;
    if (currentXhr) {
      try { currentXhr.abort(); } catch (e) {}
    }
  };

  // wire abort button
  if (abortBtn) {
    abortBtn.disabled = false;
    abortBtn.onclick = () => {
      abortUpload();
      setStatus("Upload cancelled");
      toast("Upload cancelled.", { type: "info" });
      // show retry option
      if (retryBtn) retryBtn.classList.remove("hidden");
      // restore primary button so user can try again
      confirmPaymentBtn.disabled = false;
      confirmPaymentBtn.classList.remove("opacity-50", "pointer-events-none");
    };
  }

  // upload function with progress and retries
  async function uploadWithProgress(file, maxRetries = 2, timeoutMs = 90000) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt += 1;
      setStatus(`Uploading (attempt ${attempt}/${maxRetries + 1})...`);
      try {
        const url = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          currentXhr = xhr;
          const fd = new FormData();
          fd.append("file", file);

          // progress
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setPercent(percent);
              if (percent < 30) setStatus("Uploading...");
              else if (percent < 70) setStatus("Securing connection...");
              else setStatus("Finalizing link...");
            }
          };

          // timeout
          const timer = setTimeout(() => {
            try { xhr.abort(); } catch (e) {}
            reject(new Error("Upload timed out"));
          }, timeoutMs);

          xhr.onload = () => {
            clearTimeout(timer);
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                if (res && res.url) resolve(res.url);
                else reject(new Error("Invalid upload response"));
              } catch (err) {
                reject(new Error("Invalid JSON from upload endpoint"));
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            clearTimeout(timer);
            reject(new Error("Network error during upload"));
          };

          xhr.onabort = () => {
            clearTimeout(timer);
            reject(new Error("Upload aborted"));
          };

          try {
            xhr.open("POST", uploadUrl);
            xhr.send(fd);
          } catch (err) {
            clearTimeout(timer);
            reject(err);
          }
        });

        currentXhr = null;
        return url;
      } catch (err) {
        currentXhr = null;
        if (abortedByUser) throw new Error("Upload cancelled by user");
        console.warn("Upload attempt failed:", err);
        // change progress bar to error color briefly
        setProgressColor("error");
        setStatus("Upload attempt failed");
        // small backoff
        if (attempt <= maxRetries) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
          // restore color for retry
          setProgressColor("normal");
          continue;
        }
        // all retries exhausted
        throw err;
      }
    }
    throw new Error("Upload failed after retries");
  }

  // main flow: try upload, fallback to base64, then checkout
  try {
    let screenshotUrl = null;
    try {
      screenshotUrl = await uploadWithProgress(selectedFile, 2, 90000);
      if (screenshotUrl && screenshotUrl.startsWith("/")) {
        screenshotUrl = `${location.origin}${screenshotUrl}`;
      }
      setPercent(100);
      setStatus("Upload complete");
      setProgressColor("normal");
    } catch (uploadErr) {
      console.warn("Upload failed, will fallback to base64:", uploadErr);
      setStatus("Upload failed, preparing fallback...");
      setProgressColor("error");
      // show retry button so user can try again without leaving modal
      if (retryBtn) retryBtn.classList.remove("hidden");
      // do not throw — allow user to retry or continue with fallback
    }

    // fallback to base64 if no screenshotUrl
    let base64Data = null;
    if (!screenshotUrl) {
      setStatus("Encoding image for fallback...");
      setPercent(30);
      base64Data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("Failed to read file"));
        r.readAsDataURL(selectedFile);
      });
      setPercent(60);
      setStatus("Fallback ready");
    }

    // compute totals and prepare payload
    setStatus("Deploying order...");
    const subtotal = cart.reduce((s, it) => s + Number(it.price || 0) * (it.quantity || 1), 0);
    const deliveryFee = computeDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;
    const upfront = Math.floor(total * 0.4);

    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? localStorage.getItem("ub_user_id") ?? null;
    if (!userId) {
      // softer UX: show error and keep modal open with retry
      paymentError.textContent = "User identification missing. Please restart the app or try again.";
      paymentError.classList.remove("hidden");
      setStatus("User ID missing");
      if (retryBtn) retryBtn.classList.remove("hidden");
      return;
    }

    const payload = {
      user_id: userId,
      items: cart.map((i) => ({ variant_id: i.variant_id ?? null, quantity: i.quantity ?? 1, price: i.price })),
      payment_proof_url: screenshotUrl || null,
      payment_proof_base64: screenshotUrl ? null : base64Data,
      delivery_fee: deliveryFee,
      total_price: total,
      upfront_paid: upfront
    };

    // call checkout
    const res = await fetch(`${API}/asbeza/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.status !== "ok") {
      // softer UX: show server message and allow retry
      const msg = body?.message || `Server error ${res?.status || "unknown"}`;
      paymentError.textContent = msg;
      paymentError.classList.remove("hidden");
      setStatus("Checkout failed");
      setProgressColor("error");
      if (retryBtn) retryBtn.classList.remove("hidden");
      return;
    }

    // success UI
    setStatus("Success!");
    setPercent(100);
    setProgressColor("normal");
    const finalProofUrl = screenshotUrl || body.payment_proof_url || null;
    if (finalProofUrl && typeof showUploadedConfirmation === "function") {
      showUploadedConfirmation(finalProofUrl);
    }

    // global success overlay updates (guarded)
    try {
      if (typeof successTitle !== "undefined") successTitle.textContent = "Order awaiting confirmation";
      if (typeof successText !== "undefined") successText.textContent = `Order #${body.order_id} is awaiting confirmation. We'll notify you via Telegram when it's confirmed.`;
      if (typeof successMeta !== "undefined") successMeta.textContent = `Upfront: ${formatPrice(upfront)} • Delivery: ${formatPrice(deliveryFee)}`;
      if (typeof successOverlay !== "undefined") {
        successOverlay.classList.remove("hidden");
        successOverlay.classList.add("flex");
      }
    } catch (e) {}

    // clear cart and update UI
    cart = [];
    if (typeof saveCart === "function") saveCart(cart);
    if (typeof renderCheckout === "function") renderCheckout();

    // close modal after short delay
    setTimeout(() => {
      if (typeof closePaymentModal === "function") closePaymentModal();
      if (window.Telegram?.WebApp) try { window.Telegram.WebApp.close(); } catch (e) {}
    }, 900);

  } catch (err) {
    console.error("Payment upload / checkout failed", err);
    setStatus("Error occurred");
    paymentError.textContent = err?.message || "Upload or checkout failed. Try again.";
    paymentError.classList.remove("hidden");
    setProgressColor("error");
    if (retryBtn) retryBtn.classList.remove("hidden");
  } finally {
    // restore primary button state
    confirmPaymentBtn.disabled = false;
    confirmPaymentBtn.classList.remove("opacity-50", "pointer-events-none");
    confirmPaymentBtn.innerHTML = originalBtnHtml;

    // hide retry if success, otherwise keep it visible
    if (retryBtn) {
      retryBtn.onclick = async () => {
        // hide retry and re-run the click handler flow
        retryBtn.classList.add("hidden");
        paymentError.classList.add("hidden");
        abortedByUser = false;
        // re-trigger the same handler logic by calling click programmatically
        confirmPaymentBtn.click();
      };
    }

    // cleanup abort button wiring
    if (abortBtn) {
      abortBtn.disabled = true;
      abortBtn.onclick = null;
    }
  }
});

