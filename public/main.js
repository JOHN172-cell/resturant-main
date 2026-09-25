/* Shared interaction layer for navigation, menu customization, cart state, and forms. */
(function () {
  'use strict';

  const cartKey = 'velvet-plate-cart';
  let cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
  let selectedDish = null;

  const qs = (selector, parent = document) => parent.querySelector(selector);
  const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const serviceClosedMessage = 'We are currently closed for orders. Please try again between 9:00 AM and 10:00 PM. Thank you for choosing Taste of Africa.';

  async function serviceIsActive() {
    try {
      const response = await fetch('/api/service');
      if (!response.ok) throw new Error('Service status unavailable');
      const data = await response.json();
      return data.active !== false;
    } catch (error) {
      return localStorage.getItem('velvet-plate-service-active') !== 'false';
    }
  }

  function showServiceClosedNotice() {
    window.alert(serviceClosedMessage);
  }

  async function startOrder(dish) {
    if (!await serviceIsActive()) {
      showServiceClosedNotice();
      return;
    }
    openDishModal(dish);
  }
  const money = value => `₵${value.toFixed(2)}`;

  function normalizeCurrencyLabels() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);
    textNodes.forEach(textNode => {
      textNode.nodeValue = textNode.nodeValue.replace(/GH₵|\$/g, '₵');
    });
  }

  function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    renderCart();
  }

  function setupNavigation() {
    const toggle = qs('.menu-toggle');
    const nav = qs('.site-nav');
    if (nav && !qs('a[href="about.html"]', nav)) {
      nav.insertAdjacentHTML('beforeend', '<a href="about.html">About</a>');
    }
    if (nav) {
      const currentPage = document.body.dataset.page;
      qsa('a', nav).forEach(link => link.classList.toggle('active', link.getAttribute('href') === `${currentPage === 'home' ? 'index' : currentPage}.html`));
    }
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      });
    }
    qsa('.cart-trigger').forEach(button => button.addEventListener('click', openCart));
    qsa('.close-cart, .drawer-scrim').forEach(button => button.addEventListener('click', closeCart));
  }

  function setupStaffAccess() {
    const footer = qs('.site-footer');
    if (!footer || qs('.staff-links', footer)) return;
    footer.insertAdjacentHTML('beforeend', '<small class="staff-links">Staff access · <a class="staff-admin-link" href="admin.html" aria-label="Open staff console" title="Staff console"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm5 4h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a> · <a href="orders.html">Orders</a> · <a href="reservations.html">Reservations</a></small>');
  }

  function openCart() {
    const drawer = qs('.cart-drawer');
    const scrim = qs('.drawer-scrim');
    if (!drawer) return;
    drawer.classList.add('open');
    scrim?.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
  }

  function closeCart() {
    const drawer = qs('.cart-drawer');
    const scrim = qs('.drawer-scrim');
    drawer?.classList.remove('open');
    scrim?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
  }

  function loadMenuItems() {
    const raw = localStorage.getItem('velvet-plate-menu-data');
    if (raw === null) {
      const defaults = [
        // Starters
        { id: 'carrots', name: 'Charred Heirloom Carrots', category: 'Starters', cuisine: 'Continental', price: 22, description: 'Whipped feta, sumac oil, toasted pistachio crumble.', vegetarian: true, vegan: false, glutenFree: true, image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&q=80' },
        { id: 'oysters', name: 'Ember Roasted Oysters', category: 'Starters', cuisine: 'Seafood', price: 35, description: 'Apple cider mignonette, smoked chili butter, micro sea greens.', vegetarian: false, vegan: false, glutenFree: true, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
        { id: 'bruschetta', name: 'Wild Mushroom Bruschetta', category: 'Starters', cuisine: 'Italian', price: 25, description: 'Sautéed forest mushrooms, garlic oil, thyme on artisan sourdough.', vegetarian: true, vegan: true, glutenFree: false, image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=600&q=80' },

        // Main Courses
        { id: 'chicken', name: 'Coal-Roasted Heritage Chicken', category: 'Main Courses', cuisine: 'Wood-Fired', price: 45, description: 'Preserved lemon, braised seasonal greens, rosemary chicken jus.', vegetarian: false, vegan: false, glutenFree: true, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80' },
        { id: 'steak', name: 'Wood-Grilled Hanger Steak', category: 'Main Courses', cuisine: 'Steakhouse', price: 55, description: 'Green peppercorn emulsion, triple-cooked crispy garlic potatoes.', vegetarian: false, vegan: false, glutenFree: true, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
        { id: 'margherita', name: 'Wood-Fired Margherita Pizza', category: 'Main Courses', cuisine: 'Artisan Pizza', price: 34, description: 'San Marzano tomatoes, fresh fior di latte, basil, olive oil.', vegetarian: true, vegan: false, glutenFree: false, image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80' },
        { id: 'pasta', name: 'Truffle Mushroom Tagliatelle', category: 'Main Courses', cuisine: 'Handmade Pasta', price: 38, description: 'Handcrafted ribbon pasta, black truffle oil, wild forest ragù.', vegetarian: true, vegan: true, glutenFree: false, image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281288?auto=format&fit=crop&w=600&q=80' },

        // Desserts
        { id: 'panna', name: 'Burnt Honey Panna Cotta', category: 'Desserts', cuisine: 'Patisserie', price: 20, description: 'Poached rhubarb, toasted oat crumble, vanilla blossom.', vegetarian: true, vegan: false, glutenFree: true, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=600&q=80' },
        { id: 'chocolate', name: 'Decadent Dark Chocolate Cake', category: 'Desserts', cuisine: 'Patisserie', price: 24, description: '70% Valrhona dark chocolate, wild berry reduction, sea salt.', vegetarian: true, vegan: true, glutenFree: false, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80' },

        // Drinks
        { id: 'spritz', name: 'Salted Grapefruit Spritz', category: 'Drinks', cuisine: 'Craft Cocktail', price: 18, description: 'Fresh grapefruit juice, fino sherry, sparkling soda, rosemary.', vegetarian: true, vegan: true, glutenFree: true, image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80' },
        { id: 'cooler', name: 'Hibiscus Ginger Elixir', category: 'Drinks', cuisine: 'Artisanal Drink', price: 15, description: 'Organic hibiscus brew, crushed Ghanaian ginger, fresh mint.', vegetarian: true, vegan: true, glutenFree: true, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80' }
      ];
      localStorage.setItem('velvet-plate-menu-data', JSON.stringify(defaults));
      return defaults;
    }
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    return stored.map(item => ({
      id: String(item.id || 'dish'),
      name: String(item.name || 'Untitled dish'),
      category: String(item.category || 'Starters'),
      cuisine: String(item.cuisine || 'Continental'),
      price: Number(item.price) || 0,
      description: String(item.description || ''),
      vegetarian: Boolean(item.vegetarian ?? (item.description && item.description.toLowerCase().includes('vegetarian'))),
      vegan: Boolean(item.vegan ?? (item.description && item.description.toLowerCase().includes('vegan'))),
      glutenFree: Boolean(item.glutenFree ?? (item.description && (item.description.toLowerCase().includes('gluten') || item.description.toLowerCase().includes('gluten-free')))),
      image: String(item.image || (Array.isArray(item.images) ? item.images[0] : '') || '')
    }));
  }

  function renderDynamicMenu() {
    const menuGrid = qs('.menu-grid');
    if (!menuGrid) return;

    const menuItems = loadMenuItems();
    const html = menuItems.map((item, index) => `
      <article class="menu-card" 
        data-category="${item.category.toLowerCase()}" 
        data-id="${item.id}" 
        data-name="${item.name}" 
        data-price="${item.price}" 
        data-description="${item.description || item.name}"
        data-veg="${item.vegetarian ? 'true' : 'false'}"
        data-vegan="${item.vegan ? 'true' : 'false'}"
        data-gf="${item.glutenFree ? 'true' : 'false'}">
        <div class="menu-image"${item.image ? ` style="background-image:url('${item.image}')"` : ''}>
          <span>${String(index + 1).padStart(2, '0')}</span>
        </div>
        <div class="menu-card-body">
          <span class="card-category">${item.cuisine} / ${item.category}</span>
          <h2>${item.name}</h2>
          <p>${item.description || 'Freshly prepared wood-fired culinary dish'}</p>
          <div class="menu-card-footer">
            <strong>${money(Number(item.price))}</strong>
            <button class="order-now-btn add-button" type="button">Order Now <span>+</span></button>
          </div>
        </div>
      </article>
    `).join('');

    menuGrid.innerHTML = html;
    setupCustomization();
    applyMenuFilters();
  }

  // Keep the guest menu aligned with the database after an administrator
  // adds or updates a dish, including its selected image.
  async function syncMenuFromApi() {
    try {
      const response = await fetch('/api/menu');
      const items = await response.json();
      if (!response.ok || !Array.isArray(items)) return;
      localStorage.setItem('velvet-plate-menu-data', JSON.stringify(items));
      renderDynamicMenu();
      renderHomepageMenuHighlights();
      applyMenuAvailability();
      setupCustomization();
    } catch (error) {
      console.warn('Menu sync unavailable; using the currently saved menu.', error);
    }
  }

  function renderHomepageMenuHighlights() {
    const grid = qs('#featured-menu-grid');
    if (!grid) return;

    const menuItems = loadMenuItems().slice(0, 3);
    grid.innerHTML = menuItems.map((item, index) => {
      const layoutClass = index === 0 ? ' dish-card-tall' : (index === 2 ? ' dish-card-offset' : '');
      const number = String(index + 1).padStart(2, '0');
      return `
        <article class="dish-card${layoutClass}" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}" data-category="${item.category}" data-description="${item.description || item.name}">
          <div class="dish-image"${item.image ? ` style="background-image:url('${item.image}')"` : ''}>
            <span class="dish-tag">${item.category}</span>
          </div>
          <div class="dish-meta">
            <span>${number} / ${item.cuisine} • ${money(item.price)}</span>
            <h3>${item.name}</h3>
            <p>${item.description || 'Freshly prepared by our kitchen.'}</p>
            <button type="button" class="order-now-btn add-button ghana-card-btn">Order now <span>+</span></button>
          </div>
        </article>`;
    }).join('');
  }

  function applyMenuAvailability() {
    const availability = JSON.parse(localStorage.getItem('velvet-plate-availability') || '{}');
    const menuData = JSON.parse(localStorage.getItem('velvet-plate-menu-data') || '[]');
    const validIds = new Set(menuData.map(item => String(item.id)));
    qsa('.menu-card').forEach(card => {
      const id = card.dataset.id;
      if (availability[id] === false || (id && !validIds.has(id))) card.remove();
    });
  }

  function applyMenuFilters() {
    const searchVal = (qs('#menu-search-input')?.value || '').toLowerCase().trim();
    const activeCatBtn = qs('.menu-cat-btn.active');
    const catFilter = activeCatBtn ? activeCatBtn.dataset.filter.toLowerCase() : 'all';
    
    const activeDietPills = qsa('.diet-pill.active').map(pill => pill.dataset.diet.toLowerCase());

    qsa('.menu-card').forEach(card => {
      const name = (card.dataset.name || '').toLowerCase();
      const desc = (card.dataset.description || '').toLowerCase();
      const cat = (card.dataset.category || '').toLowerCase();
      const isVeg = card.dataset.veg === 'true';
      const isVegan = card.dataset.vegan === 'true';
      const isGf = card.dataset.gf === 'true';

      // 1. Search filter
      const matchesSearch = !searchVal || name.includes(searchVal) || desc.includes(searchVal) || cat.includes(searchVal);

      // 2. Category filter
      let matchesCat = false;
      if (catFilter === 'all') matchesCat = true;
      else if (catFilter === 'starters' && cat.includes('starter')) matchesCat = true;
      else if ((catFilter === 'mains' || catFilter === 'main courses') && (cat.includes('main') || cat.includes('mains'))) matchesCat = true;
      else if (catFilter === 'desserts' && cat.includes('dessert')) matchesCat = true;
      else if (catFilter === 'drinks' && (cat.includes('drink') || cat.includes('beverage'))) matchesCat = true;

      // 3. Dietary filter
      let matchesDiet = true;
      if (activeDietPills.includes('vegetarian') && !isVeg) matchesDiet = false;
      if (activeDietPills.includes('vegan') && !isVegan) matchesDiet = false;
      if (activeDietPills.includes('gluten-free') && !isGf) matchesDiet = false;

      const show = matchesSearch && matchesCat && matchesDiet;
      card.classList.toggle('hidden', !show);
    });
  }

  function setupMenuInteractiveFilters() {
    // Category filter buttons
    qsa('.menu-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('.menu-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyMenuFilters();
      });
    });

    // Dietary filter pills
    qsa('.diet-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('active');
        applyMenuFilters();
      });
    });

    // Live search input
    const searchInput = qs('#menu-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', applyMenuFilters);
    }
  }

  // --- Dynamic Food-Type Customization Engine ---
  function detectFoodType(dish) {
    const category = String(dish.category || '').toLowerCase();
    const cuisine = String(dish.cuisine || '').toLowerCase();
    const name = String(dish.name || '').toLowerCase();

    if (category.includes('drink') || category.includes('beverage') || cuisine.includes('drink') || cuisine.includes('cocktail') || name.includes('spritz') || name.includes('elixir') || name.includes('wine') || name.includes('juice') || name.includes('beverage')) {
      return 'drink';
    }
    if (category.includes('local dish') || cuisine.includes('local dish')) {
      return 'local';
    }
    if (category.includes('dessert') || category.includes('sweet') || cuisine.includes('patisserie') || name.includes('panna cotta') || name.includes('cake') || name.includes('ice cream') || name.includes('tart') || name.includes('chocolate') || name.includes('sweet')) {
      return 'dessert';
    }
    if (name.includes('steak') || name.includes('chicken') || name.includes('lamb') || name.includes('chops') || name.includes('beef') || cuisine.includes('steakhouse') || cuisine.includes('wood-fired')) {
      return 'steak';
    }
    if (name.includes('pizza') || name.includes('pasta') || name.includes('margherita') || name.includes('tagliatelle') || name.includes('spaghetti') || cuisine.includes('italian') || cuisine.includes('pasta')) {
      return 'pizza';
    }
    if (category.includes('starter') || category.includes('appetizer') || category.includes('salad') || name.includes('carrots') || name.includes('oysters') || name.includes('bruschetta')) {
      return 'starter';
    }
    return 'general';
  }

  function getFoodTypeSchema(foodType, dish = {}) {
    const drinkStyle = String(dish.cuisine || dish.category || '').toLowerCase();
    const usesGlassSizes = foodType === 'drink' && (drinkStyle.includes('local drink') || drinkStyle.includes('juice'));

    switch (foodType) {
      case 'drink':
        return {
          badgeTitle: 'Craft Beverage Order',
          badgeIcon: '🍹',
          themeClass: 'modal-type-drink',
          buttonText: 'Add Beverage to Order',
          isDrink: true,
          sizeSelector: {
            heading: usesGlassSizes ? 'Local Drink & Juice Glass Size' : 'Drink Size',
            options: [
              { label: usesGlassSizes ? 'Small Glass' : 'Small', multiplier: 1, selected: true },
              { label: usesGlassSizes ? 'Large Glass' : 'Large', multiplier: 1.15 },
              { label: usesGlassSizes ? 'Extra-Large Glass' : 'Extra Large', multiplier: 1.3 }
            ]
          },
          primary: {
            name: 'ice',
            heading: 'Ice Preference',
            options: ['Regular Ice', 'Light Ice', 'Extra Ice', 'No Ice'],
            defaultVal: 'Regular Ice'
          },
          secondary: {
            name: 'sweetness',
            heading: 'Sweetness & Flavor',
            options: ['Standard Sweetness', 'Extra Sweet', 'Unsweetened'],
            defaultVal: 'Standard Sweetness'
          },
          extras: usesGlassSizes
            ? [
                { label: 'Fresh Ginger & Lime Infusion', cost: 2.50 },
                { label: 'Hibiscus & Mint Garnish', cost: 2.00 },
                { label: 'Coconut Cream Float', cost: 3.00 },
                { label: 'Premium Fruit Skewer', cost: 3.50 }
              ]
            : [
                { label: 'Fresh Lime Wheel', cost: 1.00 },
                { label: 'Sparkling Soda Splash', cost: 1.00 },
                { label: 'Fresh Mint Sprig', cost: 1.00 },
                { label: 'Double Shot / Premium', cost: 5.00 }
              ],
          noteLabel: 'Special instructions for the bartender'
        };

      case 'dessert':
        return {
          badgeTitle: 'Sweet Treat Order',
          badgeIcon: '🍰',
          themeClass: 'modal-type-dessert',
          buttonText: 'Add Sweet Treat to Order',
          sizeSelector: {
            heading: 'Dessert Plate Size',
            options: [
              { label: 'Small Plate', multiplier: 1, selected: true },
              { label: 'Large Plate', multiplier: 1.15 },
              { label: 'Extra-Large Plate', multiplier: 1.3 }
            ]
          },
          secondary: {
            name: 'dairy',
            heading: 'Milk & Cream Choice',
            options: ['Traditional Dairy', 'Oat Milk / Dairy-Free (+₵2.00)'],
            defaultVal: 'Traditional Dairy'
          },
          extras: [
            { label: 'Vanilla Bean Ice Cream Scoop', cost: 4.00 },
            { label: 'Valrhona Dark Drizzle', cost: 2.50 },
            { label: 'Crushed Pistachio Crumble', cost: 2.00 },
            { label: 'Fresh Berry Reduction', cost: 3.00 }
          ],
          noteLabel: 'Special requests for our pastry chef'
        };

      case 'steak':
        return {
          badgeTitle: 'Wood-Fired Grill Order',
          badgeIcon: '🥩',
          themeClass: 'modal-type-steak',
          buttonText: 'Add Grill Special to Order',
          hasPortionSelector: true,
          primary: {
            name: 'doneness',
            heading: 'Meat Cooking Temperature',
            options: ['Medium Rare', 'Rare', 'Medium', 'Medium Well', 'Well Done'],
            defaultVal: 'Medium Rare'
          },
          secondary: {
            name: 'sauce',
            heading: 'Signature Sauce',
            options: ['Peppercorn Jus', 'Smoked Chili Butter', 'Garlic Herb Butter', 'Chimichurri'],
            defaultVal: 'Peppercorn Jus'
          },
          extras: [
            { label: 'Triple-Cooked Garlic Potatoes', cost: 4.00 },
            { label: 'Ember Roasted Asparagus', cost: 5.00 },
            { label: 'Black Truffle Butter', cost: 3.00 },
            { label: 'Extra Peppercorn Jus', cost: 2.00 }
          ],
          noteLabel: 'Special preparation or sear requests'
        };

      case 'pizza':
        return {
          badgeTitle: 'Artisan Kitchen Order',
          badgeIcon: '🍕',
          themeClass: 'modal-type-pizza',
          buttonText: 'Add Artisan Dish to Order',
          hasPortionSelector: true,
          primary: {
            name: 'crust',
            heading: 'Crust / Base Preference',
            options: ['Traditional Neapolitan', 'Thin & Crispy', 'Gluten-Free Base (+₵4.00)'],
            defaultVal: 'Traditional Neapolitan'
          },
          secondary: {
            name: 'spice',
            heading: 'Sauce & Spice Intensity',
            options: ['Mild Marinara', 'Garlic & Herb', 'Spicy Chili Oil'],
            defaultVal: 'Mild Marinara'
          },
          extras: [
            { label: 'Extra Fior di Latte Cheese', cost: 4.00 },
            { label: 'Black Truffle Oil Drizzle', cost: 3.00 },
            { label: 'Fresh Basil & Olive Oil', cost: 1.50 },
            { label: 'Aged Parmesan Shavings', cost: 2.50 }
          ],
          noteLabel: 'Special crust or topping requests'
        };

      case 'local':
        return {
          badgeTitle: 'Local Dish Order',
          badgeIcon: '🍲',
          themeClass: 'modal-type-starter',
          buttonText: 'Add Local Dish to Order',
          sizeSelector: {
            heading: 'Local Dish Bowl Size',
            options: [
              { label: 'Small Bowl', multiplier: 1, selected: true },
              { label: 'Large Bowl', multiplier: 1.15 },
              { label: 'Extra-Large Bowl', multiplier: 1.3 }
            ]
          },
          noteLabel: ''
        };

      case 'starter':
      default:
        return {
          badgeTitle: 'Starter & Shareable Order',
          badgeIcon: '🥗',
          themeClass: 'modal-type-starter',
          buttonText: 'Add Starter to Order',
          sizeSelector: {
            heading: 'Plate or Bowl Size',
            options: [
              { label: 'Small Plate', multiplier: 1, selected: true },
              { label: 'Large Plate', multiplier: 1.15 },
              { label: 'Extra-Large Bowl', multiplier: 1.3 }
            ]
          },
          primary: {
            name: 'dressing',
            heading: 'Serving & Dressing Style',
            options: ['Chef House Vinaigrette', 'Creamy Feta & Sumac', 'Sumac Olive Oil', 'Dressing on Side'],
            defaultVal: 'Chef House Vinaigrette'
          },
          secondary: {
            name: 'prep',
            heading: 'Dietary Preparation',
            options: ['Standard Chef Prep', 'Make it Vegan 🌱', 'Gluten-Free Prep'],
            defaultVal: 'Standard Chef Prep'
          },
          extras: [
            { label: 'Warm Artisan Sourdough', cost: 3.00 },
            { label: 'Roasted Pistachios', cost: 2.00 },
            { label: 'Extra Whipped Feta', cost: 3.50 }
          ],
          noteLabel: 'Dietary exclusions or kitchen notes'
        };
    }
  }

  function checkoutLayerMarkup() {
    return `
      <div class="checkout-layer" aria-hidden="true">
        <section class="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <button class="modal-close checkout-close" type="button" aria-label="Close checkout">×</button>
          <div class="checkout-selection">
            <p class="eyebrow">Checkout</p>
            <h2 id="checkout-title">Pickup checkout</h2>
            <div class="checkout-price-row"><span>Food subtotal</span><strong class="checkout-subtotal">₵0.00</strong></div>
            <section class="payment-options" aria-labelledby="payment-title">
              <p class="checkout-section-title" id="payment-title">Pickup payment</p>
              <div class="pickup-payment-timing">
                <label class="fulfillment-choice"><input type="radio" name="pickup-payment-timing" value="before-pickup" checked><span><strong>Pay before pickup</strong><small>Pay online now with your preferred method.</small></span></label>
                <label class="fulfillment-choice"><input type="radio" name="pickup-payment-timing" value="on-pickup"><span><strong>Pay on pickup</strong><small>Pay when you collect your order at Taste Africa.</small></span></label>
              </div>
              <div class="payment-method-options">
                <label class="fulfillment-choice payment-choice" aria-label="Pay by card"><input type="radio" name="payment-method" value="card" checked><span><svg class="payment-logo payment-logo-card" viewBox="0 0 58 40" aria-hidden="true"><rect x="2" y="2" width="54" height="36" rx="5"/><path d="M3 13h52M10 28h14"/></svg></span></label>
                <label class="fulfillment-choice payment-choice" aria-label="Pay with Mobile Money"><input type="radio" name="payment-method" value="mobile-money"><span><b class="payment-logo payment-logo-momo" aria-hidden="true">MoMo</b></span></label>
                <label class="fulfillment-choice payment-choice" aria-label="Pay with Telecel Cash"><input type="radio" name="payment-method" value="telecel-cash"><span><b class="payment-logo payment-logo-telecel" aria-hidden="true">telecel<br>cash</b></span></label>
              </div>
            </section>
            <div class="checkout-price-row checkout-total-row"><span>Total</span><strong class="checkout-final-total">₵0.00</strong></div>
            <button class="button button-dark checkout-confirm" type="button">Confirm pickup order <span>→</span></button>
          </div>
          <div class="checkout-contact" hidden>
            <button class="checkout-back" type="button">← Back to checkout</button>
            <p class="eyebrow">Contact details</p>
            <h2 class="checkout-contact-title">Who is collecting this order?</h2>
            <p class="checkout-contact-copy">We’ll use these details if we need to reach you about your order.</p>
            <form class="checkout-contact-form">
              <label class="checkout-field">Full name<input name="customer-name" type="text" autocomplete="name" required></label>
              <label class="checkout-field">Phone number<input name="customer-phone" type="tel" autocomplete="tel" required></label>
              <button class="button button-dark checkout-place-order" type="submit">Place order <span>→</span></button>
            </form>
          </div>
          <div class="checkout-success" hidden>
            <span class="success-symbol">✓</span>
            <p class="eyebrow">Order received</p>
            <h2>That’s dinner sorted.</h2>
            <p class="checkout-success-copy">Your meal is being prepared. Thank you for trusting us with your meal.</p>
            <button class="button button-dark checkout-done" type="button">Back to the menu <span>↗</span></button>
          </div>
        </section>
      </div>
    `;
  }

  function ensureModalDOM() {
    if (qs('.modal-layer')) return;
    const modalHtml = `
      <div class="modal-layer" aria-hidden="true">
        <section class="custom-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button class="modal-close" type="button" aria-label="Close customization">×</button>
          <div class="modal-image modal-image-1"></div>
          <div class="modal-content">
            <div class="modal-type-badge" id="modal-type-badge">
              <span class="badge-icon">🍽️</span>
              <span class="badge-text">Kitchen Customizer</span>
            </div>
            <p class="eyebrow">Crafted for your taste</p>
            <h2 id="modal-title">Dish name</h2>
            <p class="modal-description"></p>
            <div id="dynamic-modal-options" class="modal-dynamic-options"></div>
            <button class="button button-dark modal-add" type="button">Add to order <span>+</span></button>
          </div>
        </section>
      </div>
      ${checkoutLayerMarkup()}
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setupCheckout();
  }

  function openDishModal(dish) {
    if (!dish) return;
    ensureModalDOM();
    selectedDish = dish;
    renderCustomizationModal(selectedDish);

    const modal = qs('.modal-layer');
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('locked');
    }
  }

  function setupCustomization() {
    ensureModalDOM();
    const allItems = loadMenuItems();

    // 1. Menu Page Cards (.menu-card)
    qsa('.menu-card').forEach(card => {
      if (card.dataset.bound) return;
      card.dataset.bound = 'true';
      card.style.cursor = 'pointer';

      card.addEventListener('click', event => {
        const dishId = card.dataset.id;
        const found = allItems.find(i => String(i.id) === String(dishId));
        const bgImg = card.querySelector('.menu-image')?.style.backgroundImage;
        let imgUrl = '';
        if (bgImg && bgImg.includes('url')) {
          imgUrl = bgImg.slice(5, -2).replace(/['"]/g, '');
        }

        const dish = found || {
          id: card.dataset.id || `dish-${Date.now()}`,
          name: card.dataset.name || card.querySelector('h2')?.textContent || 'Menu Item',
          price: Number(card.dataset.price) || 20,
          description: card.dataset.description || card.querySelector('p')?.textContent || '',
          category: card.dataset.category || '',
          cuisine: card.dataset.cuisine || card.querySelector('.card-category')?.textContent || '',
          image: imgUrl
        };
        startOrder(dish);
      });
    });

    // 2. Home Page / Featured Cards (.dish-card)
    qsa('.dish-card').forEach(card => {
      if (card.dataset.bound) return;
      card.dataset.bound = 'true';
      card.style.cursor = 'pointer';

      card.addEventListener('click', () => {
        const title = card.querySelector('h3')?.innerText.replace(/\n/g, ' ') || 'Featured Dish';
        const categoryText = card.querySelector('.dish-meta span')?.textContent || '';
        const bgImg = card.querySelector('.dish-image')?.style.backgroundImage;
        let imgUrl = '';
        if (bgImg && bgImg.includes('url')) {
          imgUrl = bgImg.slice(5, -2).replace(/['"]/g, '');
        }

        // Cards carry the exact menu ID. Prefix matching could open another
        // drink or food item when two menu names shared a word.
        const found = allItems.find(item => String(item.id) === String(card.dataset.id)) ||
          allItems.find(item => item.name.trim().toLowerCase() === title.trim().toLowerCase());

        const dish = found || {
          id: `featured-${Date.now()}`,
          name: title,
          price: 28.00,
          description: card.querySelector('.dish-meta p')?.textContent || 'Chef wood-fired featured dish.',
          category: categoryText.includes('Starter') ? 'Starter' : categoryText.includes('Sweet') ? 'Dessert' : 'Main',
          cuisine: 'Wood-Fired',
          image: imgUrl
        };
        startOrder(dish);
      });
    });

    qsa('.modal-close').forEach(button => button.addEventListener('click', closeModal));
    qs('.modal-layer')?.addEventListener('click', event => { if (event.target.classList.contains('modal-layer')) closeModal(); });
    const addBtn = qs('.modal-add');
    if (addBtn) {
      addBtn.onclick = addCustomizedItem;
    }
  }

  function renderCustomizationModal(dish) {
    const foodType = detectFoodType(dish);
    const schema = getFoodTypeSchema(foodType, dish);
    selectedDish.foodType = foodType;
    selectedDish.schema = schema;

    const modalSection = qs('.custom-modal');
    if (modalSection) {
      modalSection.className = `custom-modal ${schema.themeClass}`;
    }

    // Dynamic Image Update on Order Form
    const modalImage = qs('.modal-image');
    if (modalImage) {
      const fallbacks = {
        drink: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
        dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80',
        steak: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        pizza: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=80',
        starter: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80'
      };
      const displayImg = dish.image || fallbacks[foodType] || fallbacks.starter;
      modalImage.style.backgroundImage = `url('${displayImg}')`;
    }

    const badgeEl = qs('#modal-type-badge');
    if (badgeEl) {
      badgeEl.querySelector('.badge-icon').textContent = schema.badgeIcon;
      badgeEl.querySelector('.badge-text').textContent = schema.badgeTitle;
    }

    const titleEl = qs('#modal-title');
    if (titleEl) {
      titleEl.innerHTML = `${dish.name} <span style="font-size:22px; color:var(--tomato); margin-left:12px; font-weight:700;">₵${Number(dish.price).toFixed(2)}</span>`;
    }

    const descEl = qs('.modal-description');
    if (descEl) descEl.textContent = dish.description || 'Freshly prepared wood-fired culinary dish';

    const addBtn = qs('.modal-add');
    if (addBtn) addBtn.innerHTML = `${schema.buttonText} <span>+</span>`;

    const optionsContainer = qs('#dynamic-modal-options');
    if (!optionsContainer) return;

    let html = '';

    // Drinks use local-drink and juice sizes; starters use plate and bowl sizes.
    if (schema.sizeSelector) {
      const basePrice = Number(dish.price) || 18;

      html += `
        <div class="custom-option-section menu-size-section">
          <div class="option-heading-styled">
            <span class="opt-num">01</span>
            <strong>${schema.sizeSelector.heading}</strong>
          </div>
          <div class="custom-pill-group menu-size-pills">
            ${schema.sizeSelector.options.map((size, index) => `
              <label class="custom-pill-label">
                <input type="radio" name="menu-size" value="${size.label}" data-multiplier="${size.multiplier}" ${(size.selected || (!schema.sizeSelector.options.some(option => option.selected) && index === 0)) ? 'checked' : ''}>
                <span class="pill-btn">${size.label} <span class="pill-cost">₵${(basePrice * size.multiplier).toFixed(2)}</span></span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Food portions: every food item is ordered by portion. Local dishes use
    // this as their only customisation step.
    if (schema.hasPortionSelector) {
      html += `
        <div class="custom-option-section drink-serving-section food-portion-section">
          <div class="option-heading-styled">
            <span class="opt-num">01</span>
            <strong>Number of Portions</strong>
          </div>
          <div class="drink-quantity-stepper">
            <span class="stepper-label">Portions:</span>
            <div class="stepper-controls">
              <button type="button" class="stepper-btn" id="food-portion-minus" aria-label="Decrease portions">−</button>
              <input type="number" id="food-portion-count" value="1" min="1" max="20" readonly>
              <button type="button" class="stepper-btn" id="food-portion-plus" aria-label="Increase portions">+</button>
            </div>
          </div>
        </div>
      `;
    }

    // Primary Radio Option Group
    if (schema.primary) {
      const stepNum = schema.sizeSelector ? '02' : (schema.hasPortionSelector ? '02' : '01');
      html += `
        <div class="custom-option-section">
          <div class="option-heading-styled">
            <span class="opt-num">${stepNum}</span>
            <strong>${schema.primary.heading}</strong>
          </div>
          <div class="custom-pill-group">
            ${schema.primary.options.map((opt, i) => `
              <label class="custom-pill-label">
                <input type="radio" name="modal-primary-opt" value="${opt}" ${i === 0 ? 'checked' : ''}>
                <span class="pill-btn">${opt}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Secondary Radio Option Group
    if (schema.secondary) {
      const stepNum = schema.sizeSelector ? '03' : (schema.hasPortionSelector ? '03' : '02');
      html += `
        <div class="custom-option-section">
          <div class="option-heading-styled">
            <span class="opt-num">${stepNum}</span>
            <strong>${schema.secondary.heading}</strong>
          </div>
          <div class="custom-pill-group">
            ${schema.secondary.options.map((opt, i) => `
              <label class="custom-pill-label">
                <input type="radio" name="modal-secondary-opt" value="${opt}" ${i === 0 ? 'checked' : ''}>
                <span class="pill-btn">${opt}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Extras Checkbox Group
    if (schema.extras && schema.extras.length) {
      const stepNum = schema.sizeSelector ? '04' : (schema.hasPortionSelector ? '04' : '03');
      html += `
        <div class="custom-option-section">
          <div class="option-heading-styled">
            <span class="opt-num">${stepNum}</span>
            <strong>Add Gourmet Extras</strong>
          </div>
          <div class="custom-pill-group">
            ${schema.extras.map(extra => `
              <label class="custom-pill-label">
                <input type="checkbox" name="modal-extra-opt" value="${extra.label}" data-cost="${extra.cost}">
                <span class="pill-btn">
                  ${extra.label} <span class="pill-cost">+₵${extra.cost.toFixed(2)}</span>
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Local dishes only ask for portions; other item types can include a note.
    if (schema.noteLabel) {
      html += `
        <label class="custom-note-field">
          <span>${schema.noteLabel}</span>
          <input type="text" id="modal-note-input" placeholder="e.g. extra cold, on the rocks, allergies...">
        </label>
      `;
    }

    optionsContainer.innerHTML = html;

    // Update the displayed price whenever a drink or starter size is changed.
    if (schema.sizeSelector) {
      const basePrice = Number(dish.price) || 18;
      const sizeRadios = qsa('input[name="menu-size"]');

      function updateSizeCalculations() {
        const selectedRadio = qs('input[name="menu-size"]:checked');
        const multiplier = Number(selectedRadio?.dataset.multiplier || 1.0);

        let extraCost = 0;
        qsa('input[name="modal-extra-opt"]:checked').forEach(chk => {
          extraCost += Number(chk.dataset.cost || 0);
        });

        const total = (basePrice * multiplier) + extraCost;
        if (titleEl) {
          titleEl.innerHTML = `${dish.name} <span style="font-size:22px; color:var(--tomato); margin-left:12px; font-weight:700;">₵${total.toFixed(2)}</span>`;
        }
      }

      sizeRadios.forEach(r => r.addEventListener('change', updateSizeCalculations));
      qsa('input[name="modal-extra-opt"]').forEach(chk => chk.addEventListener('change', updateSizeCalculations));
    }

    if (schema.hasPortionSelector) {
      const portionInput = qs('#food-portion-count');
      qs('#food-portion-minus')?.addEventListener('click', () => {
        const value = Number(portionInput?.value || 1);
        if (value > 1 && portionInput) portionInput.value = value - 1;
      });
      qs('#food-portion-plus')?.addEventListener('click', () => {
        const value = Number(portionInput?.value || 1);
        if (value < 20 && portionInput) portionInput.value = value + 1;
      });
    }
  }

  function closeModal() {
    const modal = qs('.modal-layer');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
  }

  async function addCustomizedItem() {
    if (!selectedDish) return;
    if (!await serviceIsActive()) {
      showServiceClosedNotice();
      closeModal();
      return;
    }
    const foodType = selectedDish.foodType || detectFoodType(selectedDish);
    const schema = selectedDish.schema || getFoodTypeSchema(foodType, selectedDish);

    const primaryChoice = qs('input[name="modal-primary-opt"]:checked')?.value || '';
    const secondaryChoice = qs('input[name="modal-secondary-opt"]:checked')?.value || '';

    const checkedExtras = qsa('input[name="modal-extra-opt"]:checked');
    const extraLabels = [];
    let extraCost = 0;

    // Check for price additions in radios (e.g. +₵4.00, +₵2.00)
    [primaryChoice, secondaryChoice].forEach(choice => {
      const match = choice.match(/\+₵(\d+(\.\d+)?)/);
      if (match) extraCost += Number(match[1]);
    });

    checkedExtras.forEach(input => {
      extraLabels.push(input.value);
      extraCost += Number(input.dataset.cost || 0);
    });

    const notes = qs('#modal-note-input')?.value.trim() || '';

    let itemQuantity = 1;
    let itemPrice = selectedDish.price + extraCost;
    const parts = [];

    if (schema.sizeSelector) {
      const selectedSizeRadio = qs('input[name="menu-size"]:checked');
      const sizeName = selectedSizeRadio?.value || 'Large';
      const multiplier = Number(selectedSizeRadio?.dataset.multiplier || 1.0);

      parts.push(`Size: ${sizeName}`);
      itemPrice = (selectedDish.price * multiplier) + extraCost;
    }

    if (schema.hasPortionSelector) {
      const portionCount = Math.max(1, Number(qs('#food-portion-count')?.value || 1));
      parts.push(`Portions: ${portionCount}`);
      itemQuantity = portionCount;
    }

    if (primaryChoice) parts.push(primaryChoice);
    if (secondaryChoice) parts.push(secondaryChoice);
    if (extraLabels.length) parts.push(`+ ${extraLabels.join(', ')}`);
    if (notes) parts.push(`Note: ${notes}`);

    const customSummary = parts.join(' · ');

    const item = {
      ...selectedDish,
      foodType,
      primaryChoice,
      secondaryChoice,
      extras: extraLabels,
      notes,
      customSummary,
      price: itemPrice,
      quantity: itemQuantity
    };

    const match = cart.find(entry => 
      entry.id === item.id && 
      entry.customSummary === item.customSummary &&
      entry.price === item.price
    );

    if (match) {
      match.quantity += itemQuantity;
    } else {
      cart.push(item);
    }

    saveCart();
    closeModal();
    openCart();
  }

  function renderCart() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    qsa('.cart-count').forEach(count => { count.textContent = totalItems; });
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    qsa('.cart-total').forEach(element => { element.textContent = money(total); });
    qsa('.checkout-button').forEach(button => { button.disabled = cart.length === 0; });
    const items = qs('.cart-items');
    const empty = qs('.cart-empty');
    if (!items || !empty) return;
    empty.style.display = cart.length ? 'none' : 'block';

    items.innerHTML = cart.map((item, index) => {
      const summaryText = item.customSummary || [
        item.vegan ? 'Vegan' : null,
        item.spice,
        item.extras && item.extras.length ? `+ ${item.extras.join(', ')}` : null,
        item.exclusions ? `No: ${item.exclusions}` : null
      ].filter(Boolean).join(' · ') || 'Standard Prep';

      return `
        <article class="cart-line">
          <div>
            <h3>${item.name}</h3>
            <p>${summaryText}</p>
          </div>
          <strong>${money(item.price * item.quantity)}</strong>
          <div class="cart-controls">
            <button type="button" data-action="decrease" data-index="${index}" aria-label="Decrease quantity">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-action="increase" data-index="${index}" aria-label="Increase quantity">+</button>
            <button class="remove-item" type="button" data-action="remove" data-index="${index}" aria-label="Remove item">×</button>
          </div>
        </article>
      `;
    }).join('');

    qsa('[data-action]', items).forEach(button => button.addEventListener('click', () => updateQuantity(Number(button.dataset.index), button.dataset.action)));
  }

  function updateQuantity(index, action) {
    if (action === 'increase') cart[index].quantity += 1;
    if (action === 'decrease') cart[index].quantity -= 1;
    if (action === 'remove' || cart[index].quantity < 1) cart.splice(index, 1);
    saveCart();
  }

  function setupCheckout() {
    const layer = qs('.checkout-layer');
    if (!layer || layer.dataset.checkoutReady === 'true') return;
    layer.dataset.checkoutReady = 'true';

    const subtotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const selection = qs('.checkout-selection', layer);
    const contact = qs('.checkout-contact', layer);
    const success = qs('.checkout-success', layer);
    const pickupPaymentTiming = qs('.pickup-payment-timing', layer);
    const paymentMethodOptions = qs('.payment-method-options', layer);
    const pickupPaymentRadios = qsa('input[name="pickup-payment-timing"]', layer);
    const paymentMethodRadios = qsa('input[name="payment-method"]', layer);
    const selectedPickupPaymentTiming = () => qs('input[name="pickup-payment-timing"]:checked', layer)?.value || 'before-pickup';
    const selectedPaymentMethod = () => qs('input[name="payment-method"]:checked', layer)?.value || 'card';
    const contactForm = qs('.checkout-contact-form', layer);

    function showContactStep() {
      if (selection) selection.hidden = true;
      if (contact) contact.hidden = false;
    }

    function updateCheckoutTotals() {
      const foodSubtotal = subtotal();
      const total = foodSubtotal;

      qsa('.checkout-subtotal', layer).forEach(element => { element.textContent = money(foodSubtotal); });
      qsa('.checkout-final-total', layer).forEach(element => { element.textContent = money(total); });

      const paymentBeforePickup = selectedPickupPaymentTiming() === 'before-pickup';
      if (pickupPaymentTiming) pickupPaymentTiming.hidden = false;
      if (paymentMethodOptions) paymentMethodOptions.hidden = !paymentBeforePickup;

      const confirmButton = qs('.checkout-confirm', layer);
      if (confirmButton) {
        confirmButton.innerHTML = paymentBeforePickup
          ? `Pay ${money(total)} & confirm pickup <span>→</span>`
          : `Confirm pickup order <span>→</span>`;
      }
    }

    function resetCheckout() {
      if (selection) selection.hidden = false;
      if (contact) contact.hidden = true;
      if (success) success.hidden = true;
      contactForm?.reset();
      const beforePickup = qs('input[name="pickup-payment-timing"][value="before-pickup"]', layer);
      const card = qs('input[name="payment-method"][value="card"]', layer);
      if (beforePickup) beforePickup.checked = true;
      if (card) card.checked = true;
      updateCheckoutTotals();
    }

    qsa('.checkout-button').forEach(button => button.addEventListener('click', () => {
      if (!cart.length) return;
      closeCart();
      resetCheckout();
      layer.classList.add('open');
      layer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('locked');
    }));

    pickupPaymentRadios.forEach(radio => radio.addEventListener('change', updateCheckoutTotals));
    paymentMethodRadios.forEach(radio => radio.addEventListener('change', updateCheckoutTotals));

    qs('.checkout-close', layer)?.addEventListener('click', () => {
      layer.classList.remove('open');
      layer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('locked');
    });

    qs('.checkout-confirm', layer)?.addEventListener('click', async () => {
      if (!cart.length) return;
      if (!await serviceIsActive()) {
        showServiceClosedNotice();
        layer.classList.remove('open');
        layer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('locked');
        return;
      }
      showContactStep();
    });

    qs('.checkout-back', layer)?.addEventListener('click', () => {
      if (contact) contact.hidden = true;
      if (selection) selection.hidden = false;
    });

    contactForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!cart.length) return;
      const foodSubtotal = subtotal();
      const total = foodSubtotal;
      const paymentTiming = selectedPickupPaymentTiming();
      const paymentMethod = paymentTiming === 'on-pickup' ? null : selectedPaymentMethod();
      const orderData = {
        id: `order-${Date.now()}`,
        createdAt: new Date().toISOString(),
        items: cart,
        fulfillment: { method: 'pickup' },
        payment: { timing: paymentTiming, method: paymentMethod },
        customer: {
          name: qs('input[name="customer-name"]', layer)?.value.trim(),
          phone: qs('input[name="customer-phone"]', layer)?.value.trim(),
          email: null,
          address: null
        },
        subtotal: foodSubtotal,
        total,
        status: 'new'
      };
      if (!await serviceIsActive()) {
        showServiceClosedNotice();
        return;
      }

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          window.alert(result.error || serviceClosedMessage);
          return;
        }
      } catch (error) {
        window.alert('We could not place your order just now. Please try again shortly.');
        return;
      }

      const orders = JSON.parse(localStorage.getItem('velvet-plate-orders') || '[]');
      orders.push(orderData);
      localStorage.setItem('velvet-plate-orders', JSON.stringify(orders));

      cart = [];
      saveCart();
      if (selection) selection.hidden = true;
      if (contact) contact.hidden = true;
      if (success) success.hidden = false;
      const successCopy = qs('.checkout-success-copy', layer);
      if (successCopy) successCopy.textContent = 'Your meal is being prepared. Thank you for trusting us with your meal.';
    });

    qs('.checkout-done', layer)?.addEventListener('click', () => {
      layer.classList.remove('open');
      layer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('locked');
    });
  }

  function showMessage(form, message, success = false) {
    const output = qs('.form-message', form);
    if (!output) return;
    output.textContent = message;
    output.classList.toggle('success', success);
  }

  function setupResSlideshow() {
    const slides = qsa('.res-bg-slide');
    if (!slides.length) return;
    let index = 0;
    setInterval(() => {
      index = (index + 1) % slides.length;
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
      });
    }, 4500);
  }

  function setupMenuSlideshow() {
    const slides = qsa('.menu-bg-slide');
    if (!slides.length) return;
    let index = 0;
    setInterval(() => {
      index = (index + 1) % slides.length;
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
      });
    }, 4500);
  }

  function setupForms() {
    const reservationForm = qs('#reservation-form');
    reservationForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!reservationForm.checkValidity()) { showMessage(reservationForm, 'Please fill in each required field, including your phone number.'); reservationForm.reportValidity(); return; }
      const data = new FormData(reservationForm);
      const name = data.get('name');
      const email = data.get('email');
      const phone = data.get('phone');
      const date = data.get('date');
      const time = data.get('time');
      const party = data.get('party');
      const allergies = data.get('allergies') ? String(data.get('allergies')).trim() : '';
      const occasion = data.get('occasion') ? String(data.get('occasion')).trim() : '';
      const notesArr = [];
      if (allergies) notesArr.push(`Allergies: ${allergies}`);
      if (occasion) notesArr.push(`Occasion: ${occasion}`);

      const resPayload = {
        id: `reservation-${Date.now()}`,
        name,
        email,
        phone,
        date,
        time,
        party: party || '2 Guests',
        allergies,
        occasion,
        notes: notesArr.join(' | ') || 'Standard Table Reservation',
        status: 'pending'
      };

      try {
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resPayload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'We could not submit your reservation.');

        const reservations = JSON.parse(localStorage.getItem('velvet-plate-reservations') || '[]');
        reservations.push(result.reservation);
        localStorage.setItem('velvet-plate-reservations', JSON.stringify(reservations));

        const message = result.sms === 'sent'
          ? 'Your reservation has been received. An SMS confirmation has been sent to your phone.'
          : 'Your reservation has been received and will be confirmed soon.';
        showMessage(reservationForm, message, true);
        window.alert(message);
        reservationForm.reset();
      } catch (error) {
        showMessage(reservationForm, error.message || 'We could not submit your reservation.');
      }
    });
    const contactForm = qs('#contact-form');
    contactForm?.addEventListener('submit', event => {
      event.preventDefault();
      if (!contactForm.checkValidity()) { showMessage(contactForm, 'Please add your name and message.'); contactForm.reportValidity(); return; }
      showMessage(contactForm, 'Message sent. We’ll get back to you soon.', true);
      contactForm.reset();
    });
  }

  function setupThemeToggle() {
    const header = qs('.site-header');
    if (header && !qs('.theme-toggle', header)) {
      const cartBtn = qs('.cart-trigger', header);
      const themeBtnHtml = `
        <button class="theme-toggle" type="button" aria-label="Toggle theme mode">
          <span class="theme-icon">☀️</span>
          <span class="theme-text">Light</span>
        </button>
      `;
      if (cartBtn) {
        cartBtn.insertAdjacentHTML('beforebegin', themeBtnHtml);
      } else {
        header.insertAdjacentHTML('beforeend', themeBtnHtml);
      }
    }

    const savedTheme = localStorage.getItem('velvet-plate-theme') || 'light';
    applyTheme(savedTheme);

    qsa('.theme-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('velvet-plate-theme', newTheme);
      });
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    document.body.classList.toggle('light-mode', !isDark);

    qsa('.theme-toggle').forEach(btn => {
      const icon = qs('.theme-icon', btn);
      const text = qs('.theme-text', btn);
      if (icon) icon.textContent = isDark ? '🌙' : '☀️';
      if (text) text.textContent = isDark ? 'Dark' : 'Light';
    });
  }

  document.documentElement.removeAttribute('data-theme');
  document.body.classList.remove('dark-mode', 'light-mode');
  localStorage.removeItem('velvet-plate-theme');
  setupNavigation();
  setupStaffAccess();
  renderDynamicMenu();
  renderHomepageMenuHighlights();
  setupMenuInteractiveFilters();
  applyMenuAvailability();
  setupCustomization();
  setupCheckout();
  setupForms();
  setupResSlideshow();
  setupMenuSlideshow();
  setupAboutSlideshow();
  renderCart();
  normalizeCurrencyLabels();
  syncMenuFromApi();

  function setupAboutSlideshow() {
    const slides = qsa('.about-bg-slide');
    if (!slides.length) return;
    let index = 0;
    setInterval(() => {
      index = (index + 1) % slides.length;
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
      });
    }, 4500);
  }

  window.addEventListener('menu:updated', () => {
    renderDynamicMenu();
    renderHomepageMenuHighlights();
    applyMenuAvailability();
    setupCustomization();
  });

  // Keep guest pages accurate when an administrator adds or edits a menu item
  // from a different browser tab.
  window.addEventListener('storage', event => {
    if (event.key !== 'velvet-plate-menu-data' && event.key !== 'velvet-plate-availability') return;
    renderDynamicMenu();
    renderHomepageMenuHighlights();
    applyMenuAvailability();
    setupCustomization();
  });
})();
