(function () {
  'use strict';

  const reservationsKey = 'velvet-plate-reservations';
  const adminSessionKey = 'taste-africa-admin-session';
  const qs = (selector, parent = document) => parent.querySelector(selector);
  const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const adminFetch = (url, options = {}) => fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${sessionStorage.getItem(adminSessionKey) || ''}` }
  });

  let reservations = loadReservations();
  let currentFilter = 'all';
  let searchQuery = '';

  function loadReservations() {
    const raw = localStorage.getItem(reservationsKey);
    let list = [];
    try {
      list = JSON.parse(raw || '[]');
    } catch (e) {
      list = [];
    }

    if (!Array.isArray(list) || list.length === 0) {
      // Seed high-quality demo reservations if none exist
      const today = new Date().toISOString().slice(0, 10);
      list = [
        {
          id: 'res-demo-1',
          name: 'Maya Stone',
          email: 'maya.stone@example.com',
          phone: '+233 503658302',
          date: today,
          time: '7:00 PM',
          party: '2 guests',
          seating: 'Window',
          notes: 'Celebrating an anniversary dinner',
          status: 'pending'
        },
        {
          id: 'res-demo-2',
          name: 'Liam Vance',
          email: 'liam.v@example.com',
          phone: '+233 503658302',
          date: today,
          time: '8:00 PM',
          party: '4 guests',
          seating: 'Booth',
          notes: 'Nut allergy for 1 guest',
          status: 'confirmed'
        },
        {
          id: 'res-demo-3',
          name: 'Elena Rostova',
          email: 'elena.rostova@example.com',
          phone: '+233 503658302',
          date: today,
          time: '6:30 PM',
          party: '6 guests',
          seating: 'Patio',
          notes: 'High chair requested',
          status: 'confirmed'
        }
      ];
      localStorage.setItem(reservationsKey, JSON.stringify(list));
    }
    return list;
  }

  function saveReservations() {
    localStorage.setItem(reservationsKey, JSON.stringify(reservations));
    renderStats();
    renderTable();
  }

  function formatDate(value) {
    if (!value) return 'Date pending';
    try {
      return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return value;
    }
  }

  function renderStats() {
    const pending = reservations.filter(r => r.status === 'pending');
    const confirmed = reservations.filter(r => r.status === 'confirmed');
    const cancelled = reservations.filter(r => r.status === 'cancelled');

    const totalCovers = reservations
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (Number.parseInt(r.party, 10) || 0), 0);

    const coversEl = qs('#stat-covers');
    const pendingEl = qs('#stat-pending');
    const confirmedEl = qs('#stat-confirmed');
    const cancelledEl = qs('#stat-cancelled');

    if (coversEl) coversEl.textContent = totalCovers;
    if (pendingEl) pendingEl.textContent = pending.length;
    if (confirmedEl) confirmedEl.textContent = confirmed.length;
    if (cancelledEl) cancelledEl.textContent = cancelled.length;

    // Filter button count pills
    const countAll = qs('#filter-count-all');
    const countPending = qs('#filter-count-pending');
    const countConfirmed = qs('#filter-count-confirmed');
    const countCancelled = qs('#filter-count-cancelled');

    if (countAll) countAll.textContent = reservations.length;
    if (countPending) countPending.textContent = pending.length;
    if (countConfirmed) countConfirmed.textContent = confirmed.length;
    if (countCancelled) countCancelled.textContent = cancelled.length;
  }

  function renderTable() {
    const tbody = qs('#reservation-list');
    const emptyNotice = qs('#reservation-empty');
    if (!tbody) return;

    const term = searchQuery.trim().toLowerCase();
    const filtered = reservations.filter(r => {
      // Filter by tab
      if (currentFilter !== 'all' && r.status !== currentFilter) return false;

      // Filter by search query
      if (term) {
        const haystack = `${r.name} ${r.email} ${r.phone} ${r.seating} ${r.notes} ${r.time} ${r.date}`.toLowerCase();
        return haystack.includes(term);
      }
      return true;
    });

    if (emptyNotice) {
      emptyNotice.hidden = filtered.length > 0;
    }

    tbody.innerHTML = filtered.map(item => {
      return `
        <tr data-res-row="${item.id}">
          <td>
            <strong>${item.name}</strong>
            <small>${item.email}</small>
            ${item.phone ? `<small style="color:var(--admin-muted); font-size:10px;">${item.phone}</small>` : ''}
          </td>
          <td>
            <strong>${formatDate(item.date)}</strong>
            <small style="color:var(--admin-accent); font-weight:600;">${item.time || 'Pending'}</small>
          </td>
          <td>
            <span class="party-badge">${item.party || '2 guests'}</span>
          </td>
          <td>
            <span class="seating-tag">${item.seating || 'No preference'}</span>
          </td>
          <td style="max-width: 220px;">
            <span style="font-size: 11px; opacity: 0.85;">${item.notes || '—'}</span>
          </td>
          <td>
            <span class="reservation-status ${item.status}">${item.status}</span>
          </td>
          <td>
            <div class="table-actions">
              ${
                item.status === 'pending'
                  ? `
                <button type="button" class="btn-action btn-confirm" data-action="confirmed" data-id="${item.id}" title="Confirm reservation">Confirm</button>
                <button type="button" class="btn-action btn-decline" data-action="cancelled" data-id="${item.id}" title="Decline reservation">Decline</button>
              `
                  : item.status === 'confirmed'
                  ? `
                <button type="button" class="btn-action btn-reopen" data-action="pending" data-id="${item.id}" title="Move back to pending">Reopen</button>
                <button type="button" class="btn-action btn-decline" data-action="cancelled" data-id="${item.id}" title="Cancel reservation">Cancel</button>
              `
                  : `
                <button type="button" class="btn-action btn-reopen" data-action="pending" data-id="${item.id}" title="Reopen reservation">Reopen</button>
              `
              }
              <button type="button" class="btn-action btn-delete" data-delete-res="${item.id}" title="Delete booking record">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind action buttons
    qsa('[data-action]', tbody).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const newStatus = btn.dataset.action;
        updateStatus(id, newStatus);
      });
    });

    // Bind delete buttons
    qsa('[data-delete-res]', tbody).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteRes;
        deleteReservation(id);
      });
    });
  }

  function updateStatus(id, status) {
    const res = reservations.find(r => r.id === id);
    if (!res) return;
    const request = status === 'confirmed'
      ? adminFetch(`/api/reservations/${id}/confirm`, { method: 'POST' })
      : adminFetch(`/api/reservations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    request.then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update reservation.');
      Object.assign(res, data.reservation);
      saveReservations();
      if (status === 'confirmed' && (data.notifications?.email !== 'sent' || data.notifications?.sms !== 'sent')) {
        alert(`Reservation confirmed. Notification status — email: ${data.notifications?.email}; SMS: ${data.notifications?.sms}`);
      }
    }).catch(error => alert(error.message));
  }

  async function loadReservationsFromApi() {
    try {
      const response = await adminFetch('/api/reservations');
      if (!response.ok) throw new Error('Could not load reservations.');
      reservations = await response.json();
      renderStats();
      renderTable();
    } catch (error) {
      console.error(error);
    }
  }

  function deleteReservation(id) {
    const res = reservations.find(r => r.id === id);
    if (!res) return;
    adminFetch(`/api/reservations/${id}`, { method: 'DELETE' })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).error || 'Could not delete reservation.');
        reservations = reservations.filter(r => r.id !== id);
        saveReservations();
      })
      .catch(error => alert(error.message));
  }

  // Setup tab filters
  function setupFilters() {
    qsa('[data-reservation-filter]').forEach(button => {
      button.addEventListener('click', () => {
        qsa('[data-reservation-filter]').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.reservationFilter;
        renderTable();
      });
    });
  }

  // Setup live search
  function setupSearch() {
    const searchInput = qs('#reservation-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderTable();
    });
  }

  // Setup Add Reservation modal
  function setupAddReservationModal() {
    const modal = qs('#add-reservation-modal');
    const openBtn = qs('#open-add-reservation');
    const closeBtn = qs('#close-add-reservation');
    const form = qs('#manual-reservation-form');

    if (!modal || !openBtn || !form) return;

    openBtn.addEventListener('click', () => {
      modal.hidden = false;
      const today = new Date().toISOString().slice(0, 10);
      const dateInput = form.querySelector('input[name="date"]');
      if (dateInput && !dateInput.value) dateInput.value = today;
      form.querySelector('input[name="name"]')?.focus();
    });

    const closeModal = () => {
      modal.hidden = true;
      form.reset();
    };

    closeBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get('name') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const phone = String(formData.get('phone') || '').trim();
      const date = String(formData.get('date') || '').trim();
      const time = String(formData.get('time') || '').trim();
      const party = String(formData.get('party') || '2 guests').trim();
      const seating = String(formData.get('seating') || 'No preference').trim();
      const notes = String(formData.get('notes') || '').trim();

      if (!name || !date || !time) {
        alert('Please provide guest name, date, and reservation time.');
        return;
      }

      const newBooking = {
        id: `res-${Date.now()}`,
        name,
        email: email || 'walk-in@thevelvetplate.com',
        phone: phone || 'Walk-in / Phone booking',
        date,
        time,
        party,
        seating,
        notes,
        status: 'confirmed' // Staff entries are confirmed by default
      };

      reservations.unshift(newBooking);
      saveReservations();
      closeModal();
    });
  }

  // Date in Header
  const dateSpan = qs('#reservations-date');
  if (dateSpan) {
    dateSpan.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  // Refresh queue button
  const refreshBtn = qs('#refresh-reservations');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadReservationsFromApi();
      refreshBtn.textContent = 'Refreshed ✓';
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh ↻';
      }, 1000);
    });
  }

  // Auto refresh poll every 10 seconds for reservations from other tabs (like guest booking form)
  setInterval(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(reservationsKey) || '[]');
      if (stored.length !== reservations.length) {
        reservations = stored;
        renderStats();
        renderTable();
      }
    } catch (e) {}
  }, 10000);

  // Initialize
  setupFilters();
  setupSearch();
  setupAddReservationModal();
  renderStats();
  renderTable();
  window.addEventListener('admin:authenticated', loadReservationsFromApi);
})();
