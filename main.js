// main.js (ES module)
const API = "https://deliveraau.onrender.com/api";
let cart = [];

async function loadItems() {
  try {
    const res = await fetch(`${API}/asbeza/items`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.items || [];

    const container = document.getElementById("items");
    container.innerHTML = "";

    if (items.length === 0) {
      container.innerHTML = `<p class="empty">No items available right now.</p>`;
      return;
    }

    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "item-card";

      // Use base_price (matches backend schema)
      const price = item.base_price ?? item.price ?? 0;

      div.innerHTML = `
        <div class="item-info">
          <h2 class="item-name">${escapeHtml(item.name)}</h2>
          <p class="item-desc">${escapeHtml(item.description || "")}</p>
          <p class="item-price">${price} birr</p>
        </div>
        <div class="item-actions">
          <button class="add-btn">Add</button>
        </div>
      `;

      // Attach click handler
      div.querySelector(".add-btn").addEventListener("click", () => {
        addToCart({ ...item, price });
      });

      container.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load items:", err);
    const container = document.getElementById("items");
    container.innerHTML = `<p class="error">Failed to load items. Try again later.</p>`;
  }
}

function addToCart(item) {
  cart.push(item);
  // simple UI feedback
  alert(`${item.name} added to cart`);
}

async function checkout() {
  try {
    const tg = window.Telegram?.WebApp;
    const userId = tg?.initDataUnsafe?.user?.id ?? null;

    const payload = {
      user_id: userId,
      items: cart.map(i => ({
        variant_id: i.variant_id ?? null,
        quantity: 1,
        price: i.price
      }))
    };

    const res = await fetch(`${API}/asbeza/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Checkout failed: ${res.status} ${text}`);
    }

    const body = await res.json();
    alert(`Order placed. Upfront: ${body.upfront ?? "N/A"}`);
    if (tg) tg.close();
  } catch (err) {
    console.error("Checkout error:", err);
    alert("Checkout failed. See console for details.");
  }
}

// small helper to avoid XSS when injecting text
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.getElementById("checkoutBtn").addEventListener("click", checkout);

// initial load
loadItems();
