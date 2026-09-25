(function () {
  'use strict';

  const reservationsKey = 'velvet-plate-reservations';
  const menuKey = 'velvet-plate-availability';
  const menuDataKey = 'velvet-plate-menu-data';
  const kitchenKey = 'taste-africa-kitchen-active';
  const adminSessionKey = 'taste-africa-admin-session';
  const cloudinaryConfig = {
    cloudName: '',
    uploadPreset: ''
  };

  const defaultMenuItems = [
    { id: 'carrots', name: 'Charred carrots', category: 'Starter', cuisine: 'Continental', price: 12, description: 'whipped feta, sumac, pistachio', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80' },
    { id: 'oysters', name: 'Ember oysters', category: 'Starter', cuisine: 'Continental', price: 18, description: 'cider mignonette, smoked chili', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80' },
    { id: 'chicken', name: 'Coal-roasted chicken', category: 'Main', cuisine: 'Continental', price: 28, description: 'preserved lemon, chicken jus', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80' },
    { id: 'steak', name: 'Hanger steak', category: 'Main', cuisine: 'Continental', price: 34, description: 'green peppercorn, crispy potato', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80' },
    { id: 'panna', name: 'Burnt honey panna cotta', category: 'Dessert', cuisine: 'Continental', price: 11, description: 'rhubarb, oat crumble', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=80' },
    { id: 'spritz', name: 'Salted grapefruit spritz', category: 'Drink', cuisine: 'Local drinks', price: 14, description: 'grapefruit, fino sherry, bubbles', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=400&q=80' }
  ];

  const categoryFallbacks = {
    Starter: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80',
    Main: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
    Dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=80',
    Drink: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=400&q=80'
  };

  const qs = (selector, parent = document) => parent.querySelector(selector);
  const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const adminFetch = (url, options = {}) => {
    const token = sessionStorage.getItem(adminSessionKey);
    return fetch(url, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  };
  const money = value => `GH₵${Number(value).toFixed(2)}`;

  let reservations = JSON.parse(localStorage.getItem(reservationsKey) || '[]');
  let menuItems = loadMenuItems();
  let availability = loadAvailability();
  let menuSearch = '';

  function loadMenuItems() {
    const raw = localStorage.getItem(menuDataKey);
    // Key missing = genuine first visit: seed with defaults
    if (raw === null) {
      localStorage.setItem(menuDataKey, JSON.stringify(defaultMenuItems));
      return [...defaultMenuItems];
    }
    // Key exists but is empty array = admin deliberately deleted everything
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) {
      localStorage.setItem(menuDataKey, JSON.stringify(defaultMenuItems));
      return [...defaultMenuItems];
    }
    return stored.map(item => ({
      id: String(item.id || slugify(item.name || 'dish')),
      name: String(item.name || 'Untitled dish'),
      category: String(item.category || 'Starter'),
      cuisine: String(item.cuisine || 'Continental'),
      price: Number(item.price) || 0,
      description: String(item.description || ''),
      vegetarian: Boolean(item.vegetarian),
      vegan: Boolean(item.vegan),
      glutenFree: Boolean(item.glutenFree),
      image: String(item.image || (Array.isArray(item.images) ? item.images[0] : '') || ''),
      images: Array.isArray(item.images) ? item.images.map(String) : (item.image ? [String(item.image)] : [])
    }));
  }

  function loadAvailability() {
    const state = JSON.parse(localStorage.getItem(menuKey) || '{}');
    menuItems.forEach(item => {
      if (state[item.id] === undefined) state[item.id] = true;
    });
    localStorage.setItem(menuKey, JSON.stringify(state));
    return state;
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `dish-${Date.now()}`;
  }

  function renderStats() {
    const covers = reservations
      .filter(item => item.status !== 'cancelled')
      .reduce((sum, item) => sum + (Number.parseInt(item.party, 10) || 0), 0);
    const cart = JSON.parse(localStorage.getItem('velvet-plate-cart') || '[]');
    const ordersStat = qs('#orders-stat');
    const menuStat = qs('#menu-stat');
    const coversStat = qs('#covers-stat');
    const serviceSummaryStat = qs('#service-summary-stat');

    if (ordersStat) ordersStat.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (menuStat) menuStat.textContent = menuItems.filter(item => availability[item.id] !== false).length;
    if (coversStat) coversStat.textContent = covers;
    if (serviceSummaryStat) {
      const active = localStorage.getItem(kitchenKey) !== 'false';
      serviceSummaryStat.textContent = active ? 'LIVE' : 'OFF';
      serviceSummaryStat.style.color = active ? '#315d39' : '#c1553d';
    }
  }

  function renderMenu() {
    const container = qs('#admin-menu-list');
    const emptyNotice = qs('#menu-search-empty');
    if (!container) return;

    const searchTerm = menuSearch.trim().toLowerCase();
    const matchingItems = menuItems.filter(item => {
      if (!searchTerm) return true;
      const haystack = `${item.name} ${item.cuisine} ${item.category} ${item.description}`.toLowerCase();
      return haystack.includes(searchTerm);
    });

    container.innerHTML = matchingItems.map(item => {
      const isAvailable = availability[item.id] !== false;
      const image = item.image || (item.images && item.images[0]) || categoryFallbacks[item.category] || categoryFallbacks.Main;
      return `
        <div class="admin-menu-item">
          <div class="admin-menu-thumb" role="img" aria-label="${item.name} preview" style="background-image:url('${image}')"></div>
          <div>
            <strong>${item.name}</strong>
            <p>${item.cuisine} · ${item.category} · ${money(item.price)}</p>
            ${item.description ? `<p style="font-size: 11px; opacity: 0.75; margin-top: 3px;">${item.description}</p>` : ''}
          </div>
          <div class="admin-menu-actions">
            <button type="button" class="availability-toggle ${isAvailable ? 'available' : ''}" aria-label="${isAvailable ? 'Set as unavailable' : 'Set as available'} ${item.name}" data-menu-id="${item.id}" aria-pressed="${isAvailable}">
              <span>${isAvailable ? 'Available' : 'Unavailable'}</span>
            </button>
            <button type="button" class="delete-menu-item" aria-label="Delete ${item.name}" data-delete-menu-id="${item.id}">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (emptyNotice) {
      emptyNotice.hidden = matchingItems.length > 0;
    }

    // Bind availability toggles
    qsa('[data-menu-id]', container).forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.menuId;
        availability[id] = !(availability[id] !== false);
        localStorage.setItem(menuKey, JSON.stringify(availability));
        
        // Sync with API
        adminFetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, available: availability[id] })
        }).catch(err => console.log('API sync notice:', err));

        renderMenu();
        renderStats();
        window.dispatchEvent(new CustomEvent('menu:updated'));
      });
    });

    // Bind delete buttons
    qsa('[data-delete-menu-id]', container).forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.deleteMenuId;
        deleteMenuItem(id);
      });
    });
  }

  function deleteMenuItem(id) {
    const item = menuItems.find(entry => entry.id === id);
    if (!item) return;

    menuItems = menuItems.filter(entry => entry.id !== id);
    delete availability[id];
    localStorage.setItem(menuDataKey, JSON.stringify(menuItems));
    localStorage.setItem(menuKey, JSON.stringify(availability));

    // Sync deletion with API
    adminFetch(`/api/menu/${id}`, { method: 'DELETE' })
      .catch(err => console.log('API sync notice:', err));

    renderMenu();
    renderStats();
    window.dispatchEvent(new CustomEvent('menu:updated'));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        return reject(new Error('Selected file is not a supported image format.'));
      }
      if (file.size > 10 * 1024 * 1024) {
        return reject(new Error('Image must be smaller than 10MB.'));
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageToCloudinary(file) {
    if (!cloudinaryConfig.cloudName || !cloudinaryConfig.uploadPreset) {
      throw new Error('Cloudinary not configured');
    }
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', cloudinaryConfig.uploadPreset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
      method: 'POST',
      body
    });
    if (!response.ok) throw new Error('Cloudinary upload failed.');
    const result = await response.json();
    return result.secure_url;
  }

  async function processSelectedImages(files, category) {
    const selectedFiles = [...files].filter(f => f && f.size > 0);
    if (!selectedFiles.length) {
      return [categoryFallbacks[category] || categoryFallbacks.Main];
    }

    // Try Cloudinary if explicitly configured
    if (cloudinaryConfig.cloudName && cloudinaryConfig.uploadPreset) {
      try {
        return await Promise.all(selectedFiles.map(uploadImageToCloudinary));
      } catch (err) {
        console.warn('Cloudinary upload unviable, falling back to local storage:', err);
      }
    }

    // Otherwise read locally as data URLs
    try {
      return await Promise.all(selectedFiles.map(readFileAsDataUrl));
    } catch (err) {
      console.warn('Local file read error, falling back to default photo:', err);
      return [categoryFallbacks[category] || categoryFallbacks.Main];
    }
  }

  async function addMenuItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const category = String(formData.get('category') || 'Starter');
    const cuisine = String(formData.get('cuisine') || 'Continental');
    const price = Number(formData.get('price'));
    const description = String(formData.get('description') || '').trim();
    const vegan = formData.get('vegan') === 'on';
    const glutenFree = formData.get('glutenFree') === 'on';
    const imageFiles = formData.getAll('images').filter(file => file && file.size > 0);

    if (!name || !Number.isFinite(price) || price <= 0) {
      alert('Please provide a valid dish name and price.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving dish...';
    }

    let images = [];
    try {
      images = await processSelectedImages(imageFiles, category);
    } catch (error) {
      console.error('Image processing error:', error);
      images = [categoryFallbacks[category] || categoryFallbacks.Main];
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }

    const item = {
      id: slugify(name),
      name,
      category,
      cuisine,
      price,
      description: description || `${cuisine} ${category.toLowerCase()} specialty`,
      // Vegan dishes are also vegetarian, so both guest-menu filters work.
      vegetarian: vegan,
      vegan,
      glutenFree,
      image: images[0] || categoryFallbacks[category] || categoryFallbacks.Main,
      images
    };

    const existingIndex = menuItems.findIndex(
      entry => entry.id === item.id || entry.name.toLowerCase() === name.toLowerCase()
    );

    if (existingIndex >= 0) {
      menuItems[existingIndex] = { ...menuItems[existingIndex], ...item };
    } else {
      menuItems.push(item);
    }

    availability[item.id] = true;
    localStorage.setItem(menuDataKey, JSON.stringify(menuItems));
    localStorage.setItem(menuKey, JSON.stringify(availability));

    // Sync with API
    adminFetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).catch(err => console.log('API sync notice:', err));

    form.reset();
    const uploadStatus = qs('#upload-file-status');
    if (uploadStatus) uploadStatus.textContent = '';

    renderMenu();
    renderStats();
    window.dispatchEvent(new CustomEvent('menu:updated'));
    closeAddItemModal();
  }

  function closeAddItemModal() {
    const modal = qs('#add-item-modal');
    const trigger = qs('#open-add-item');
    if (!modal) return;
    modal.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  }

  function setupAddItemModal() {
    const modal = qs('#add-item-modal');
    const trigger = qs('#open-add-item');
    const closeButton = qs('#close-add-item');
    if (!modal || !trigger) return;

    trigger.addEventListener('click', () => {
      modal.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      qs('#add-menu-form input[name="name"]')?.focus();
    });

    closeButton?.addEventListener('click', closeAddItemModal);

    modal.addEventListener('click', event => {
      if (event.target === modal) closeAddItemModal();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) closeAddItemModal();
    });
  }

  function setupDishStyleOptions() {
    const categoryField = qs('#dish-category');
    const styleField = qs('select[name="cuisine"]');
    if (!categoryField || !styleField) return;

    const updateStyleOptions = () => {
      const isDrink = categoryField.value === 'Drink';
      qsa('[data-drink-style]', styleField).forEach(option => {
        option.hidden = !isDrink;
      });
      qsa('[data-food-style]', styleField).forEach(option => {
        option.hidden = isDrink;
      });

      const validFoodStyle = ['Continental', 'Local dish'].includes(styleField.value);
      const validDrinkStyle = qsa('[data-drink-style]', styleField).some(option => option.value === styleField.value);

      if ((isDrink && !validDrinkStyle) || (!isDrink && !validFoodStyle)) {
        styleField.value = isDrink ? 'Local drinks' : 'Continental';
      }
    };

    categoryField.addEventListener('change', updateStyleOptions);
    updateStyleOptions();
  }

  function setupImageDropZone() {
    const zone = qs('#food-upload-zone');
    const input = qs('#food-images');
    const status = qs('#upload-file-status');
    if (!zone || !input) return;

    const updateStatus = files => {
      if (status) {
        status.textContent = files.length
          ? `${files.length} photo${files.length === 1 ? '' : 's'} selected and ready`
          : '';
      }
    };

    const openPicker = event => {
      if (event.target !== input) input.click();
    };

    zone.addEventListener('click', openPicker);
    zone.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });

    input.addEventListener('change', () => updateStatus([...input.files]));
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('is-dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('is-dragging');
      if (event.dataTransfer.files.length) {
        input.files = event.dataTransfer.files;
        updateStatus([...input.files]);
      }
    });
  }

  function setupServiceToggle() {
    const toggle = qs('#service-toggle');
    const label = qs('#service-toggle-label');
    const dot = qs('#service-status-dot');
    if (!toggle) return;

    const update = active => {
      toggle.classList.toggle('is-on', active);
      toggle.setAttribute('aria-pressed', String(active));
      if (label) label.textContent = active ? 'Kitchen open' : 'Kitchen closed';
      if (dot) dot.classList.toggle('is-on', active);
      renderStats();
    };

    let active = localStorage.getItem(kitchenKey) !== 'false';
    update(active);

    fetch('/api/kitchen-activity')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        active = data.open !== false;
        localStorage.setItem(kitchenKey, String(active));
        update(active);
      })
      .catch(() => {});

    toggle.addEventListener('click', async () => {
      const nextActive = !active;
      toggle.disabled = true;
      try {
        const response = await adminFetch('/api/kitchen-activity', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ open: nextActive })
        });
        if (!response.ok) throw new Error('Unable to update service status');
        const data = await response.json();
        active = data.open !== false;
      } catch (error) {
        // The server is the source of truth; do not show an unsaved state.
        console.error('Kitchen status was not saved:', error);
      } finally {
        localStorage.setItem(kitchenKey, String(active));
        update(active);
        toggle.disabled = false;
      }
    });
  }

  function setupAuth() {
    const authPanel = qs('#admin-auth');
    const app = qs('#admin-app');
    const form = qs('#admin-login-form');
    const error = qs('#admin-auth-error');
    const lockButton = qs('#admin-lock');
    const loginSplash = qs('.admin-login-splash');
    const passwordField = qs('#admin-password');
    const usernameField = qs('#admin-username');
    const showPasswordButton = qs('#togglePw');

    const unlock = () => {
      document.body.classList.add('is-authenticated');
      if (authPanel) authPanel.hidden = true;
      if (app) app.hidden = false;
      loginSplash?.setAttribute('hidden', 'hidden');
      renderStats();
      renderMenu();
    };

    const lock = () => {
      document.body.classList.remove('is-authenticated');
      const token = sessionStorage.getItem(adminSessionKey);
      sessionStorage.removeItem(adminSessionKey);
      if (token) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
      if (app) app.hidden = true;
      if (authPanel) authPanel.hidden = false;
      loginSplash?.removeAttribute('hidden');
      if (form) form.reset();
      if (error) error.textContent = '';
      usernameField?.focus();
    };

    // Always demand credentials when this route is opened or revisited.
    const staleToken = sessionStorage.getItem(adminSessionKey);
    if (staleToken) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${staleToken}` }, keepalive: true }).catch(() => {});
    sessionStorage.removeItem(adminSessionKey);
    document.body.classList.remove('is-authenticated');

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const username = String(usernameField?.value || '').trim();
      const password = String(passwordField?.value || '').trim();

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to sign in.');
        sessionStorage.setItem(adminSessionKey, payload.token);
        unlock();
        return;
      } catch (loginError) {
        if (error) error.textContent = loginError.message;
      }
      if (passwordField) passwordField.value = '';
      passwordField?.focus();
    });

    showPasswordButton?.addEventListener('click', () => {
      if (!passwordField) return;
      const isPassword = passwordField.type === 'password';
      passwordField.type = isPassword ? 'text' : 'password';
      showPasswordButton.textContent = isPassword ? 'Hide' : 'Show';
      showPasswordButton.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });

    lockButton?.addEventListener('click', lock);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && document.body.classList.contains('is-authenticated')) lock();
    });
    window.addEventListener('pagehide', () => {
      const token = sessionStorage.getItem(adminSessionKey);
      if (token) {
        sessionStorage.removeItem(adminSessionKey);
        fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
      }
    });
  }

  function startSlideshow(selector) {
    const slides = qsa(selector);
    let currentSlideIndex = 0;
    if (!slides.length) return;
    setInterval(() => {
      currentSlideIndex = (currentSlideIndex + 1) % slides.length;
      slides.forEach((slide, index) => {
        slide.classList.toggle('is-active', index === currentSlideIndex);
      });
    }, 5000);
  }

  // Initialize features
  startSlideshow('.admin-login-slide');
  startSlideshow('.admin-dashboard-slide');

  const menuSearchInput = qs('#menu-search');
  menuSearchInput?.addEventListener('input', event => {
    menuSearch = event.target.value;
    renderMenu();
  });

  qs('#add-menu-form')?.addEventListener('submit', addMenuItem);
  setupAddItemModal();
  setupDishStyleOptions();
  setupImageDropZone();
  setupServiceToggle();

  const dateSpan = qs('#admin-date');
  if (dateSpan) {
    dateSpan.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  setupAuth();
  renderStats();
  renderMenu();
})();
