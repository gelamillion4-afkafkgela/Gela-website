const byId = (id) => document.getElementById(id);
async function call(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}
function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}
async function loadDashboard() {
  try {
    const [s, orders, products, wholesale] = await Promise.all([
      call("/api/admin/summary"),
      call("/api/admin/orders"),
      call("/api/admin/products"),
      call("/api/admin/wholesale"),
    ]);
    byId("loginPanel").classList.add("hidden");
    byId("dashboard").classList.remove("hidden");
    byId("stats").innerHTML = `<div class="stat">Orders<strong>${ s.orders.count }</strong></div><div class="stat">Paid order value<strong>${Number( s.orders.paid_total ).toLocaleString()}</strong></div><div class="stat">New wholesale enquiries<strong>${ s.wholesale.count }</strong></div>`;
    byId("ordersTable").innerHTML = orders.length
      ? `<table class="admin-table"><thead><tr><th>Reference / customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${orders .map( (o) => `<tr><td><b>${esc(o.order_ref)}</b><br>${esc( o.customer_name )}<br>${esc(o.email)}<br>${esc(o.country)}</td><td>${o.items .map((i) => `${esc(i.name)} × ${i.quantity}`) .join("<br>")}</td><td>${esc(o.total)} ${esc( o.currency )}</td><td>${esc(o.payment_status)}<br>${esc( o.payment_method )}</td><td><select data-order="${o.id}">${[ "pending", "processing", "shipped", "completed", "cancelled", ] .map( (x) => `<option ${ o.order_status === x ? "selected" : "" }>${x}</option>` ) .join("")}</select></td></tr>` ) .join("")}</tbody></table>`
      : "No orders yet.";
    document.querySelectorAll("[data-order]").forEach(
      (el) =>
        (el.onchange = async () => {
          try {
            await call("/api/admin/orders/" + el.dataset.order, {
              method: "PATCH",
              body: JSON.stringify({ status: el.value }),
            });
          } catch (e) {
            alert(e.message);
          }
        })
    );
    byId(
      "productsTable"
    ).innerHTML = `<table class="admin-table"><thead><tr><th>Product</th><th>ETB price</th><th>USD price</th><th>Stock</th><th>Save</th></tr></thead><tbody>${products .map( (p) => `<tr><td>${esc(p.name)}<br><small>${esc(p.origin)} · ${esc( p.type )}</small></td><td><input type="number" min="0" step=".01" id="etb-${ p.id }" value="${ p.price_etb }"></td><td><input type="number" min="0" step=".01" id="usd-${ p.id }" value="${ p.price_usd }"></td><td><input type="number" min="0" step="1" id="stock-${ p.id }" value="${ p.stock }"></td><td><button class="btn btn-dark" data-product="${ p.id }">Save</button></td></tr>` ) .join("")}</tbody></table>`;
    document.querySelectorAll("[data-product]").forEach(
      (b) =>
        (b.onclick = async () => {
          const id = b.dataset.product;
          try {
            await call("/api/admin/products/" + id, {
              method: "PATCH",
              body: JSON.stringify({
                price_etb: byId("etb-" + id).value,
                price_usd: byId("usd-" + id).value,
                stock: byId("stock-" + id).value,
              }),
            });
            alert("Product updated.");
          } catch (e) {
            alert(e.message);
          }
        })
    );
    byId("wholesaleTable").innerHTML = wholesale.length
      ? `<table class="admin-table"><thead><tr><th>Company / contact</th><th>Country</th><th>Interest</th><th>Quantity</th><th>Contact</th><th>Message</th></tr></thead><tbody>${wholesale .map( (w) => `<tr><td>${esc(w.company)}<br>${esc( w.contact_name )}</td><td>${esc(w.country)}</td><td>${esc( w.coffee_interest )}</td><td>${esc(w.estimated_quantity)}</td><td>${esc( w.email )}<br>${esc(w.phone)}</td><td>${esc(w.message)}</td></tr>` ) .join("")}</tbody></table>`
      : "No wholesale enquiries yet.";
  } catch (e) {
    if (e.message.includes("login") || e.message.includes("session")) {
      byId("dashboard").classList.add("hidden");
      byId("loginPanel").classList.remove("hidden");
    } else alert(e.message);
  }
}
byId("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  try {
    await call("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await loadDashboard();
  } catch (err) {
    byId("loginMessage").textContent = err.message;
  }
});
byId("logout").onclick = async () => {
  await call("/api/auth/logout", { method: "POST" });
  location.reload();
};
loadDashboard();