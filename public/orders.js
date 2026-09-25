(function () {
  'use strict';

  const ordersKey = 'velvet-plate-orders';
  const qs = (selector, parent = document) => parent.querySelector(selector);
  const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  let orders = loadOrders();

  function loadOrders() {
    const raw = localStorage.getItem(ordersKey);
    let list = [];
    try {
      list = JSON.parse(raw || '[]');
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list)) return [];
    const realOrders = list.filter(item => !String(item.id || '').startsWith('order-demo-'));
    // Permanently clear demo tickets that older versions stored in the browser.
    if (realOrders.length !== list.length) {
      localStorage.setItem(ordersKey, JSON.stringify(realOrders));
    }
    return realOrders;
  }

  function saveOrders() {
    localStorage.setItem(ordersKey, JSON.stringify(orders));
    render();
  }

  function render() {
    const groups = { new: [], progress: [], done: [] };
    orders.forEach(order => {
      const status = order.status === 'new' ? 'new' : order.status === 'progress' ? 'progress' : 'done';
      groups[status].push(order);
    });

    const newCount = qs('#new-order-count');
    const activeCount = qs('#active-order-count');
    const doneCount = qs('#done-order-count');
    const newColCount = qs('#new-column-count');
    const progColCount = qs('#progress-column-count');
    const doneColCount = qs('#done-column-count');

    if (newCount) newCount.textContent = groups.new.length;
    if (activeCount) activeCount.textContent = groups.progress.length;
    if (doneCount) doneCount.textContent = groups.done.length;

    if (newColCount) newColCount.textContent = groups.new.length;
    if (progColCount) progColCount.textContent = groups.progress.length;
    if (doneColCount) doneColCount.textContent = groups.done.length;

    renderGroup('#new-orders', groups.new, 'progress', 'Start preparing →');
    renderGroup('#progress-orders', groups.progress, 'done', 'Mark ready for pickup ✓');
    renderGroup('#done-orders', groups.done, 'done', 'Completed');
  }

  function renderGroup(selector, items, nextStatus, actionLabel) {
    const target = qs(selector);
    if (!target) return;

    if (!items.length) {
      target.innerHTML = '<div class="order-empty">No tickets in this column.</div>';
      return;
    }

    target.innerHTML = items
      .slice()
      .reverse()
      .map(order => {
        const orderNum = order.id ? order.id.slice(-4) : '0000';
        const timeFormatted = order.createdAt
          ? new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : 'Just now';

        const orderTotal = (order.items || []).reduce(
          (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
          0
        );

        const itemsHtml = (order.items || [])
          .map(
            item => `
            <li>
              <strong>${item.quantity} × ${item.name}</strong>
              <span>GH₵${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
            </li>
          `
          )
          .join('');

        const prefsHtml = (order.items || [])
          .map(item => {
            if (item.customSummary) {
              return `• <em>${item.name}</em>: ${item.customSummary}`;
            }
            const extrasText = item.extras && item.extras.length ? ` / + ${item.extras.join(', ')}` : '';
            const exclusionsText = item.exclusions ? ` / No: ${item.exclusions}` : '';
            return `• <em>${item.name}</em>: ${item.vegan ? 'Vegan' : 'Standard'} / ${item.spice || 'Mild'}${extrasText}${exclusionsText}`;
          })
          .join('<br>');

        return `
          <article class="order-card ${order.status}">
            <div class="order-card-top">
              <div>
                <strong>Order #${orderNum}</strong>
                <time style="display:block; font-size:10px; opacity:0.6; margin-top:2px;">${timeFormatted}</time>
              </div>
              <strong style="color:var(--tomato); font-size:13px;">GH₵${orderTotal.toFixed(2)}</strong>
            </div>
            <ul class="order-items">
              ${itemsHtml}
            </ul>
            ${prefsHtml ? `<p class="order-preferences">${prefsHtml}</p>` : ''}
            <div style="display:flex; gap:8px; margin-top:16px;">
              <button type="button" class="order-action" data-order-id="${order.id}" data-next-status="${nextStatus}" ${order.status === 'done' ? 'disabled' : ''}>
                ${actionLabel}
              </button>
              ${
                order.status === 'done'
                  ? `<button type="button" class="order-remove-btn" data-delete-id="${order.id}" title="Remove ticket">×</button>`
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');

    qsa(`${selector} [data-order-id]`).forEach(button => {
      button.addEventListener('click', () => {
        updateOrder(button.dataset.orderId, button.dataset.nextStatus);
      });
    });

    qsa(`${selector} [data-delete-id]`).forEach(button => {
      button.addEventListener('click', () => {
        deleteOrder(button.dataset.deleteId);
      });
    });
  }

  function updateOrder(id, status) {
    const order = orders.find(item => item.id === id);
    if (!order) return;
    order.status = status;
    saveOrders();

    fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).catch(err => console.log('API sync notice:', err));
  }

  function deleteOrder(id) {
    orders = orders.filter(item => item.id !== id);
    saveOrders();

    fetch(`/api/orders/${id}`, { method: 'DELETE' })
      .catch(err => console.log('API sync notice:', err));
  }

  // Date Header
  const dateEl = qs('#orders-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  // Refresh Button
  const refreshBtn = qs('#refresh-orders');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      orders = loadOrders();
      render();
      refreshBtn.textContent = 'Refreshed ✓';
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh queue ↻';
      }, 1000);
    });
  }

  // Auto poll every 10 seconds for new orders placed in other tabs
  setInterval(() => {
    const stored = loadOrders();
    if (stored.length !== orders.length) {
      orders = stored;
      render();
    }
  }, 10000);

  render();
})();
