const state = {
  products: [],
  cart: [],
  currency: "ETB",
  filter: "all",
  config: {},
};
const $ = (id) => document.getElementById(id);
const money = (amount) =>
  `${state.currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, })}`;
const priceFor = (p) =>
  Number(state.currency === "USD" ? p.price_usd : p.price_etb);
const safe = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function saveCart() {
  localStorage.setItem("dag-cart", JSON.stringify(state.cart));
  renderCart();
}
function loadCart() {
  try {
    state.cart = JSON.parse(localStorage.getItem("dag-cart") || "[]");
    if (!Array.isArray(state.cart)) state.cart = [];
  } catch {
    state.cart = [];
  }
}
function renderProducts() {
  const list = state.products.filter(
    (p) => state.filter === "all" || p.type === state.filter
  );
  $("productCount").textContent = `${list.length} products`;
  $("productGrid").innerHTML =
    list
      .map(
        (p) => ` <article class="product-card"> <img src="${safe(p.image_url)}" alt="${safe( p.name )}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80'"> <div class="product-body"> <div class="product-meta"><span>${safe(p.origin)}</span><span>${safe( p.type )} coffee</span></div> <h3>${safe(p.name)}</h3> <p>${safe(p.description)}</p> <div class="product-bottom"><span class="product-price">${ priceFor(p) > 0 ? money(priceFor(p)) : "Request a quote" }</span><button class="add-button" data-add="${p.id}" ${ Number(p.stock) <= 0 ? "disabled" : "" }>${ Number(p.stock) <= 0 ? "Out of stock" : "ADD TO CART" }</button></div> <span class="stock-note">${safe(p.process)} · ${safe(p.grade)} · ${safe( p.weight_kg )} kg pack · ${p.stock} available</span> </div> </article>`
      )
      .join("") || `<p class="muted">No products in this category yet.</p>`;
  document
    .querySelectorAll("[data-add]")
    .forEach((btn) =>
      btn.addEventListener("click", () => addToCart(Number(btn.dataset.add)))
    );
}
function addToCart(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  const item = state.cart.find((i) => i.id === id);
  if (item) item.quantity = Math.min(100, item.quantity + 1);
  else state.cart.push({ id, quantity: 1 });
  saveCart();
  openCart();
}
function cartDetails() {
  return state.cart
    .map((i) => {
      const p = state.products.find((p) => p.id === i.id);
      return p ? { ...i, product: p, price: priceFor(p) } : null;
    })
    .filter(Boolean);
}
function renderCart() {
  const items = cartDetails();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  $("cartCount").textContent = count;
  $("cartTotal").textContent = money(total);
  $("checkoutTotal").textContent = money(total);
  $("cartItems").innerHTML = items.length
    ? items
        .map(
          (i) => ` <div class="cart-line"><div><strong>${safe( i.product.name )}</strong><small>${money(i.price)} each · ${money( i.price * i.quantity )}</small></div> <div class="qty-control"><button data-minus="${ i.id }" aria-label="Decrease">−</button><b>${i.quantity}</b><button data-plus="${ i.id }" aria-label="Increase">+</button></div></div>`
        )
        .join("")
    : `<p class="muted">Your cart is empty. Explore our coffee selection.</p>`;
  document
    .querySelectorAll("[data-minus]")
    .forEach((b) => (b.onclick = () => changeQty(Number(b.dataset.minus), -1)));
  document
    .querySelectorAll("[data-plus]")
    .forEach((b) => (b.onclick = () => changeQty(Number(b.dataset.plus), 1)));
}
function changeQty(id, delta) {
  const item = state.cart.find((i) => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter((i) => i.id !== id);
  saveCart();
}
function openCart() {
  $("cartDrawer").classList.add("open");
  $("drawerBackdrop").classList.add("open");
  $("cartDrawer").setAttribute("aria-hidden", "false");
}
function closeCart() {
  $("cartDrawer").classList.remove("open");
  $("drawerBackdrop").classList.remove("open");
  $("cartDrawer").setAttribute("aria-hidden", "true");
}
function setCurrency(value) {
  state.currency = value === "USD" ? "USD" : "ETB";
  $("currencySelect").value = state.currency;
  renderProducts();
  renderCart();
}
async function init() {
  loadCart();
  try {
    const [products, config] = await Promise.all([
      api("/api/products"),
      api("/api/config"),
    ]);
    state.products = products;
    state.config = config;
    $("contactWhatsApp").href = `https://wa.me/${config.whatsapp}`;
    $("contactWhatsApp").textContent = `WhatsApp: +${config.whatsapp.slice( 0, 3 )} ${config.whatsapp.slice(3, 6)} ${config.whatsapp.slice(6)}`;
    if (config.email) {
      $("contactEmail").href = `mailto:${config.email}`;
      $("contactEmail").textContent = config.email;
    }
    renderProducts();
    renderCart();
  } catch (e) {
    $("productGrid").innerHTML = `<p class="form-message">${safe( e.message )} Please refresh the page.</p>`;
  }
  $("year").textContent = new Date().getFullYear();
}
$("currencySelect").addEventListener("change", (e) =>
  setCurrency(e.target.value)
);
$("openCart").onclick = openCart;
$("closeCart").onclick = closeCart;
$("drawerBackdrop").onclick = closeCart;
$("checkoutButton").onclick = () => {
  if (!state.cart.length) {
    alert("Your cart is empty.");
    return;
  }
  closeCart();
  $("checkoutDialog").showModal();
};
$("closeCheckout").onclick = () => $("checkoutDialog").close();
$("menuToggle").onclick = () => $("mainNav").classList.toggle("open");
document.querySelectorAll(".filter").forEach((btn) =>
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    renderProducts();
  })
);
$("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = $("placeOrderButton"),
    msg = $("checkoutMessage");
  button.disabled = true;
  button.textContent = "Processing…";
  msg.textContent = "";
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.currency = state.currency;
  payload.items = state.cart.map((i) => ({ id: i.id, quantity: i.quantity }));
  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (result.method === "whatsapp") {
      localStorage.removeItem("dag-cart");
      state.cart = [];
      saveCart();
      window.open(result.whatsappUrl, "_blank", "noopener");
      msg.textContent = `Order ${result.orderRef} created. Continue in WhatsApp to confirm shipping and payment.`;
    } else {
      window.location.href = result.checkoutUrl;
    }
  } catch (err) {
    msg.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = "Place Order";
  }
});
$("wholesaleFormElement").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("wholesaleMessage");
  msg.textContent = "Sending enquiry…";
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  try {
    const result = await api("/api/wholesale", {
      method: "POST",
      body: JSON.stringify(data),
    });
    msg.textContent = result.message;
    e.currentTarget.reset();
  } catch (err) {
    msg.textContent = err.message;
  }
});
init();