
// DAG ETHIOPIAN COFFEE SETTINGS

const BUSINESS = {
  whatsapp: "2519XXXXXXXX",
  email: "yourbusiness@email.com",
  currency: "ETB"
};

// EDIT THESE PRODUCTS AND PRICES

const products = [
  {
    id: 1,
    name: "Yirgacheffe Coffee",
    description: "Floral aroma with bright citrus notes.",
    price: 1200,
    image: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    name: "Sidama Coffee",
    description: "Rich flavor with fruity characteristics.",
    price: 1100,
    image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 3,
    name: "Guji Coffee",
    description: "Distinctive aroma and complex flavor.",
    price: 1300,
    image: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 4,
    name: "Limu Coffee",
    description: "Balanced taste and pleasant aroma.",
    price: 1000,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 5,
    name: "Jimma Coffee",
    description: "Traditional Ethiopian coffee character.",
    price: 950,
    image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 6,
    name: "Ethiopian Coffee Beans",
    description: "Discover the heritage of Ethiopian coffee.",
    price: 1150,
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80"
  }
];

// Shopping cart

let cart = JSON.parse(localStorage.getItem("dagCart") || "[]");

function money(amount) {
  return BUSINESS.currency + " " + amount.toLocaleString();
}

// Display products

function displayProducts() {
  const grid = document.getElementById("product-grid");

  grid.innerHTML = products.map(product => `
    <div class="product-card">
      <img src="${product.image}"
           alt="${product.name}"
           loading="lazy">

      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="price">${money(product.price)}</div>
        <button class="primary-button"
                onclick="addToCart(${product.id})">
          Add to Cart
        </button>
      </div>
    </div>
  `).join("");
}

// Add product

function addToCart(id) {
  const product = products.find(p => p.id === id);
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  saveCart();
  toggleCart(true);
}

// Remove product

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
}

// Change quantity

function changeQuantity(id, amount) {
  const item = cart.find(item => item.id === id);

  if (!item) return;

  item.quantity += amount;

  if (item.quantity <= 0) {
    removeFromCart(id);
  } else {
    saveCart();
  }
}

// Save cart

function saveCart() {
  localStorage.setItem("dagCart", JSON.stringify(cart));
  renderCart();
}

// Display cart

function renderCart() {
  const container = document.getElementById("cart-items");

  const count = cart.reduce(
    (total, item) => total + item.quantity, 0
  );

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  document.getElementById("cart-count").textContent = count;
  document.getElementById("cart-total").textContent = money(total);

  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <strong>${item.name}</strong>
        <p>${money(item.price)} × ${item.quantity}</p>
        <p>${money(item.price * item.quantity)}</p>
      </div>

      <div>
        <button onclick="changeQuantity(${item.id}, 1)">+</button>
        <button onclick="changeQuantity(${item.id}, -1)">−</button>
        <button onclick="removeFromCart(${item.id})">Remove</button>
      </div>
    </div>
  `).join("");
}

// Open and close cart

function toggleCart(forceOpen = false) {
  document.getElementById("cart-panel")
    .classList.add("active");

  document.getElementById("cart-overlay")
    .classList.add("active");
}

function closeCart() {
  document.getElementById("cart-panel")
    .classList.remove("active");

  document.getElementById("cart-overlay")
    .classList.remove("active");
}

// WhatsApp checkout

function checkout() {
  if (cart.length === 0) {
    alert("Your shopping cart is empty!");
    return;
  }

  if (BUSINESS.whatsapp.includes("X")) {
    alert("Please configure your WhatsApp number in script.js first.");
    return;
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  let message = "Hello DAG Ethiopian Coffee!\n\n";
  message += "I would like to order:\n\n";

  cart.forEach(item => {
    message += `${item.name}\n`;
    message += `Quantity: ${item.quantity}\n`;
    message += `Subtotal: ${money(item.price * item.quantity)}\n\n`;
  });

  message += `Total: ${money(total)}\n\n`;
  message += "Please provide ordering and delivery information.";

  const url =
    "https://wa.me/" +
    BUSINESS.whatsapp +
    "?text=" +
    encodeURIComponent(message);

  window.open(url, "_blank");
}

// Business contact information

document.getElementById("contact-whatsapp").href =
  "https://wa.me/" + BUSINESS.whatsapp;

document.getElementById("contact-email").href =
  "mailto:" + BUSINESS.email;

document.getElementById("contact-email").textContent =
  BUSINESS.email;

// Current year

document.getElementById("year").textContent =
  new Date().getFullYear();

// Initialize website

displayProducts();
renderCart();
