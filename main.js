const API = "https://deliveraau.onrender.com/api";

let cart = [];

async function loadItems() {
  const res = await fetch(`${API}/asbeza/items`);
  const items = await res.json();

  const container = document.getElementById("items");

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl shadow flex justify-between";

    div.innerHTML = `
      <div>
        <h2 class="font-semibold">${item.name}</h2>
        <p class="text-sm text-gray-500">${item.price} birr</p>
      </div>
      <button class="bg-black text-white px-3 py-1 rounded"
        onclick='addToCart(${JSON.stringify(item)})'>
        Add
      </button>
    `;

    container.appendChild(div);
  });
}

function addToCart(item) {
  cart.push(item);
  alert(`${item.name} added to cart`);
}

document.getElementById("checkoutBtn").onclick = async () => {
  const tg = window.Telegram.WebApp;
  const userId = tg.initDataUnsafe.user.id;

  await fetch(`${API}/asbeza/checkout`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      user_id: userId,
      items: cart
    })
  });

  tg.close();
};

loadItems();