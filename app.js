const products = [
  {
    id: 'ocean-villa',
    apiId: 1,
    name: 'Ocean Villa',
    category: 'Villas',
    price: 680,
    unit: 'night',
    stock: 4,
    popularity: 98,
    newestOrder: 3,
    availability: 'Available',
    description: 'A secluded one-bedroom retreat with an infinity pool, sunset deck, and uninterrupted ocean views.',
    details: ['2–4 guests', '1 king bed', 'Private pool'],
    imageClass: 'product-image-villa'
  },
  {
    id: 'horizon-suite',
    apiId: 2,
    name: 'Horizon Suite',
    category: 'Suites',
    price: 420,
    unit: 'night',
    stock: 2,
    popularity: 92,
    newestOrder: 2,
    availability: 'Limited Spots',
    description: 'An airy signature suite with a generous terrace, soaking tub, and golden-hour views from every angle.',
    details: ['2–3 guests', '1 king bed', 'Ocean terrace'],
    imageClass: 'product-image-suite'
  },
  {
    id: 'garden-casita',
    apiId: 3,
    name: 'Garden Casita',
    category: 'Suites',
    price: 285,
    unit: 'night',
    stock: 0,
    popularity: 84,
    newestOrder: 1,
    availability: 'Fully Booked',
    description: 'A peaceful garden hideaway with a shaded courtyard, outdoor shower, and a path straight to the beach.',
    details: ['2 guests', '1 king bed', 'Private courtyard'],
    imageClass: 'product-image-casita'
  },
  {
    id: 'sunset-sailing',
    apiId: 4,
    name: 'Sunset Sailing',
    category: 'Experiences',
    price: 145,
    unit: 'person',
    stock: 6,
    popularity: 96,
    newestOrder: 6,
    availability: 'Limited Spots',
    description: 'Drift into golden hour aboard a private catamaran with chilled refreshments and an open horizon.',
    details: ['2.5 hours', 'Small group', 'Refreshments'],
    imageClass: 'product-image-sailing'
  },
  {
    id: 'ocean-to-table',
    apiId: 5,
    name: 'Ocean-to-Table Dining',
    category: 'Spa & Dining',
    price: 120,
    unit: 'person',
    stock: 8,
    popularity: 89,
    newestOrder: 5,
    availability: 'Available',
    description: 'A five-course coastal menu that follows the day’s catch, served under an open evening sky.',
    details: ['5 courses', 'Wine pairing option', '7:00 PM'],
    imageClass: 'product-image-dining'
  },
  {
    id: 'stillness-spa',
    apiId: 6,
    name: 'Stillness by the Sea Spa',
    category: 'Spa & Dining',
    price: 195,
    unit: 'person',
    stock: 0,
    popularity: 91,
    newestOrder: 4,
    availability: 'Fully Booked',
    description: 'A restorative ocean-inspired ritual with warm stone therapy, botanical oils, and quiet time by the sea.',
    details: ['90 minutes', 'Private pavilion', 'Herbal tea'],
    imageClass: 'product-image-spa'
  }
];
const INITIAL_STOCK = Object.fromEntries(products.map(product => [product.id, product.stock]));

const searchForm = document.querySelector('#stay-search');
const checkInInput = document.querySelector('#check-in');
const checkOutInput = document.querySelector('#check-out');
const guestInput = document.querySelector('#guests');
const productSearch = document.querySelector('#product-search');
const suggestions = document.querySelector('#search-suggestions');
const productGrid = document.querySelector('#product-grid');
const catalogueEmpty = document.querySelector('#catalogue-empty');
const cart = document.querySelector('#booking-cart');
const cartItems = document.querySelector('#cart-items');
const cartFooter = document.querySelector('#cart-footer');
const emptyCart = document.querySelector('#empty-cart');
const toast = document.querySelector('#toast');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#nav-links');
const productDialog = document.querySelector('#product-dialog');
const accountDialog = document.querySelector('#account-dialog');
const checkoutDialog = document.querySelector('#checkout-dialog');

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const CART_STORAGE_KEY = 'sunsetResortCartV1';
const USERS_STORAGE_KEY = 'sunsetResortUsersV1';
const SESSION_STORAGE_KEY = 'sunsetResortSessionV1';
const INVENTORY_STORAGE_KEY = 'sunsetResortInventoryV1';
const BOOKINGS_STORAGE_KEY = 'sunsetResortBookingsV1';
const API_TOKEN_STORAGE_KEY = 'sunsetResortApiTokenV1';
const API_USER_STORAGE_KEY = 'sunsetResortApiUserV1';
const TAX_RATE = 0.125;
const RESORT_FEE_PER_ROOM_NIGHT = 45;
const state = { items: [], query: '', category: 'All', priceRange: 'all', sortBy: 'featured', activeProductId: null, currentUser: null };
const API_BASE_URL = window.SUNSET_API_BASE_URL
  || (window.location.port === '5000' ? `${window.location.origin}/api` : 'http://127.0.0.1:5000/api');
let activeSuggestionIndex = -1;
let lastFocusedElement;

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  const token = localStorage.getItem(API_TOKEN_STORAGE_KEY);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Server request failed with status ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) error.isNetwork = true;
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeApiUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    createdAt: user.created_at,
    source: 'api'
  };
}

function persistApiSession(payload) {
  const user = normalizeApiUser(payload.user);
  localStorage.setItem(API_TOKEN_STORAGE_KEY, payload.token);
  localStorage.setItem(API_USER_STORAGE_KEY, JSON.stringify(user));
  state.currentUser = user;
}

async function syncProductsFromApi() {
  try {
    const payload = await apiRequest('/products');
    payload.products.forEach(apiProduct => {
      const product = products.find(item => item.apiId === Number(apiProduct.id));
      if (!product) return;
      product.name = apiProduct.name;
      product.category = apiProduct.category;
      product.description = apiProduct.description;
      product.price = Number(apiProduct.price_usd);
      product.stock = Number(apiProduct.stock_quantity);
      product.availability = apiProduct.availability_status;
      product.rating = Number(apiProduct.rating);
    });
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(Object.fromEntries(products.map(product => [product.id, product.stock]))));
    renderProducts();
    renderCart();
    return true;
  } catch (error) {
    if (!error.isNetwork && error.status !== 503) console.warn('Sunset Resort API product sync failed:', error.message);
    return false;
  }
}

function toISODate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().split('T')[0];
}

function safeDate(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

function setInitialDates() {
  const today = new Date();
  const arrival = new Date(today);
  const departure = new Date(today);
  arrival.setDate(today.getDate() + 14);
  departure.setDate(today.getDate() + 17);
  checkInInput.min = toISODate(today);
  checkInInput.value = toISODate(arrival);
  checkOutInput.min = toISODate(new Date(arrival.getTime() + 86_400_000));
  checkOutInput.value = toISODate(departure);
}

function getNights() {
  const arrival = safeDate(checkInInput.value);
  const departure = safeDate(checkOutInput.value);
  if (!arrival || !departure) return 1;
  return Math.max(1, Math.round((departure - arrival) / 86_400_000));
}

function cartItemFor(id) {
  return state.items.find(item => item.id === id);
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
  } catch {
    showToast('Your cart could not be saved in this browser.');
  }
}

function loadCart() {
  try {
    const savedItems = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(savedItems)) return;
    state.items = savedItems.map(item => {
      const product = products.find(productItem => productItem.id === item.id);
      if (!product || product.stock < 1) return null;
      const quantity = Math.min(product.stock, Math.max(1, Number.parseInt(item.quantity, 10) || 1));
      return { id: product.id, quantity };
    }).filter(Boolean);
  } catch {
    state.items = [];
  }
}

function loadInventory() {
  try {
    const savedInventory = JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY) || '{}');
    products.forEach(product => {
      const savedStock = Number.parseInt(savedInventory[product.id], 10);
      product.stock = Number.isFinite(savedStock) ? Math.min(INITIAL_STOCK[product.id], Math.max(0, savedStock)) : INITIAL_STOCK[product.id];
    });
  } catch {
    products.forEach(product => { product.stock = INITIAL_STOCK[product.id]; });
  }
}

function saveInventory() {
  try {
    const inventory = Object.fromEntries(products.map(product => [product.id, product.stock]));
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    return true;
  } catch {
    return false;
  }
}

function productAvailability(product) {
  if (product.stock === 0) return 'Fully Booked';
  if (product.stock <= 2) return 'Limited Spots';
  return product.availability;
}

function getStoredUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function createSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const payload = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFormAlert(element, messages) {
  if (!messages.length) {
    element.hidden = true;
    element.textContent = '';
    return;
  }
  element.innerHTML = messages.length === 1 ? messages[0] : `<ul>${messages.map(message => `<li>${message}</li>`).join('')}</ul>`;
  element.hidden = false;
  element.focus?.();
}

function setInvalidFields(form, invalidIds) {
  form.querySelectorAll('input').forEach(input => input.setAttribute('aria-invalid', String(invalidIds.includes(input.id))));
}

function loadSession() {
  try {
    const apiToken = localStorage.getItem(API_TOKEN_STORAGE_KEY);
    const apiUser = JSON.parse(localStorage.getItem(API_USER_STORAGE_KEY) || 'null');
    if (apiToken && apiUser) {
      state.currentUser = apiUser;
      return;
    }
    const activeUserId = localStorage.getItem(SESSION_STORAGE_KEY);
    state.currentUser = getStoredUsers().find(user => user.id === activeUserId) || null;
    if (!state.currentUser && activeUserId) localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    state.currentUser = null;
  }
}

function updateAccountUI() {
  const signedIn = Boolean(state.currentUser);
  const firstName = state.currentUser?.fullName.split(/\s+/)[0] || '';
  document.querySelector('#nav-account-label').textContent = signedIn ? `Hi, ${firstName}` : 'Account';
  document.querySelector('#nav-logout').hidden = !signedIn;
  document.querySelector('#account-button').hidden = signedIn;
  document.querySelector('#account-session').hidden = !signedIn;
  document.querySelector('#account-guest-name').textContent = state.currentUser?.fullName || '';
  document.querySelector('#account-copy').textContent = signedIn
    ? 'Your saved details and future escapes are ready whenever you return to this browser.'
    : 'Save favorite stays, revisit your itinerary, and keep every part of your escape together.';
}

function switchAccountTab(tabName) {
  document.querySelectorAll('[data-account-tab]').forEach(button => {
    const selected = button.dataset.accountTab === tabName;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.querySelector('#register-panel').hidden = tabName !== 'register';
  document.querySelector('#login-panel').hidden = tabName !== 'login';
  showFormAlert(document.querySelector('#register-alert'), []);
  showFormAlert(document.querySelector('#login-alert'), []);
}

function openAccountModal(defaultTab = 'register') {
  if (state.currentUser) {
    document.querySelector('#account').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  lastFocusedElement = document.activeElement;
  switchAccountTab(defaultTab);
  accountDialog.showModal();
  window.setTimeout(() => document.querySelector(`#${defaultTab}-panel input`).focus(), 40);
}

function closeAccountModal() {
  if (accountDialog.open) accountDialog.close();
  lastFocusedElement?.focus();
}

function logOut() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(API_TOKEN_STORAGE_KEY);
  localStorage.removeItem(API_USER_STORAGE_KEY);
  state.currentUser = null;
  updateAccountUI();
  showToast('You have been logged out.');
}

async function registerUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const alert = document.querySelector('#register-alert');
  const fullName = document.querySelector('#register-name').value.trim();
  const email = document.querySelector('#register-email').value.trim().toLowerCase();
  const phone = document.querySelector('#register-phone').value.trim();
  const password = document.querySelector('#register-password').value;
  const confirmPassword = document.querySelector('#register-confirm').value;
  const errors = [];
  const invalidIds = [];
  if (!fullName) { errors.push('Enter your full name.'); invalidIds.push('register-name'); }
  if (!email) { errors.push('Enter your email address.'); invalidIds.push('register-email'); }
  else if (!validEmail(email)) { errors.push('Enter a valid email address.'); invalidIds.push('register-email'); }
  if (!phone) { errors.push('Enter your phone number.'); invalidIds.push('register-phone'); }
  if (!password) { errors.push('Create a password.'); invalidIds.push('register-password'); }
  else if (password.length < 6) { errors.push('Password must be at least 6 characters.'); invalidIds.push('register-password'); }
  if (!confirmPassword) { errors.push('Confirm your password.'); invalidIds.push('register-confirm'); }
  else if (password !== confirmPassword) { errors.push('Passwords must match.'); invalidIds.push('register-confirm'); }
  setInvalidFields(form, invalidIds);
  showFormAlert(alert, errors);
  if (errors.length) return;

  try {
    const payload = await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ full_name: fullName, email, phone, password })
    });
    persistApiSession(payload);
    updateAccountUI();
    form.reset();
    closeAccountModal();
    showToast(`Welcome to Sunset Resort, ${fullName.split(/\s+/)[0]}.`);
    return;
  } catch (error) {
    if (!error.isNetwork && error.status !== 503) {
      showFormAlert(alert, [error.message]);
      return;
    }
  }

  const users = getStoredUsers();
  if (users.some(user => user.email === email)) {
    setInvalidFields(form, ['register-email']);
    showFormAlert(alert, ['An account already exists for this email. Try logging in instead.']);
    return;
  }

  try {
    const salt = createSalt();
    const passwordHash = await hashPassword(password, salt);
    const user = {
      id: crypto.randomUUID ? crypto.randomUUID() : `guest-${Date.now()}`,
      fullName,
      email,
      phone,
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    localStorage.setItem(SESSION_STORAGE_KEY, user.id);
    state.currentUser = user;
    updateAccountUI();
    form.reset();
    closeAccountModal();
    showToast(`Welcome to Sunset Resort, ${fullName.split(/\s+/)[0]}.`);
  } catch {
    showFormAlert(alert, ['Your account could not be saved in this browser. Please try again.']);
  }
}

async function logInUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const alert = document.querySelector('#login-alert');
  const email = document.querySelector('#login-email').value.trim().toLowerCase();
  const password = document.querySelector('#login-password').value;
  const errors = [];
  const invalidIds = [];
  if (!email) { errors.push('Enter your email address.'); invalidIds.push('login-email'); }
  else if (!validEmail(email)) { errors.push('Enter a valid email address.'); invalidIds.push('login-email'); }
  if (!password) { errors.push('Enter your password.'); invalidIds.push('login-password'); }
  else if (password.length < 6) { errors.push('Password must be at least 6 characters.'); invalidIds.push('login-password'); }
  setInvalidFields(form, invalidIds);
  showFormAlert(alert, errors);
  if (errors.length) return;

  try {
    const payload = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    persistApiSession(payload);
    updateAccountUI();
    form.reset();
    closeAccountModal();
    showToast(`Welcome back, ${state.currentUser.fullName.split(/\s+/)[0]}.`);
    return;
  } catch (error) {
    if (!error.isNetwork && error.status !== 503) {
      setInvalidFields(form, ['login-email', 'login-password']);
      showFormAlert(alert, [error.message]);
      return;
    }
  }

  try {
    const user = getStoredUsers().find(item => item.email === email);
    const passwordHash = user ? await hashPassword(password, user.salt) : '';
    if (!user || passwordHash !== user.passwordHash) {
      setInvalidFields(form, ['login-email', 'login-password']);
      showFormAlert(alert, ['Email or password did not match a registered account.']);
      return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, user.id);
    state.currentUser = user;
    updateAccountUI();
    form.reset();
    closeAccountModal();
    showToast(`Welcome back, ${user.fullName.split(/\s+/)[0]}.`);
  } catch {
    showFormAlert(alert, ['Login is unavailable in this browser right now. Please try again.']);
  }
}

function getFilteredProducts() {
  const normalizedQuery = state.query.trim().toLowerCase();
  const filtered = products.filter(product => {
    const searchableText = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
    const matchesCategory = state.category === 'All' || product.category === state.category;
    const matchesPrice = state.priceRange === 'all'
      || (state.priceRange === 'under-150' && product.price < 150)
      || (state.priceRange === '150-350' && product.price >= 150 && product.price < 350)
      || (state.priceRange === '350-plus' && product.price >= 350);
    return matchesQuery && matchesCategory && matchesPrice;
  });
  const sorters = {
    'price-low': (a, b) => a.price - b.price,
    'price-high': (a, b) => b.price - a.price,
    popularity: (a, b) => b.popularity - a.popularity,
    newest: (a, b) => b.newestOrder - a.newestOrder
  };
  return sorters[state.sortBy] ? [...filtered].sort(sorters[state.sortBy]) : filtered;
}

function availabilityClass(status) {
  return status.toLowerCase().replaceAll(' ', '-');
}

function renderProducts() {
  const filtered = getFilteredProducts();
  productGrid.innerHTML = filtered.map(product => {
    const isBooked = product.stock === 0;
    const cartItem = cartItemFor(product.id);
    const quantityInCart = cartItem?.quantity || 0;
    const atStockLimit = quantityInCart >= product.stock;
    const availability = productAvailability(product);
    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-image ${product.imageClass}" role="img" aria-label="${product.name} at Sunset Resort">
          <span class="category-tag">${product.category}</span>
          <span class="availability-badge ${availabilityClass(availability)}">${availability}</span>
        </div>
        <div class="product-body">
          <div class="product-title-row">
            <div><p class="product-category">${product.category}</p><h3>${product.name}</h3></div>
            <p class="price"><strong>${money.format(product.price)}</strong><span>/ ${product.unit}</span></p>
          </div>
          <p class="product-description">${product.description}</p>
          <div class="product-meta">${product.details.map(detail => `<span>${detail}</span>`).join('')}</div>
          <p class="product-stock-note">${isBooked ? 'No availability for these dates' : `${product.stock - quantityInCart} of ${product.stock} remaining`}</p>
          <div class="product-actions">
            <button class="view-details" type="button" data-view-product="${product.id}">View details</button>
            <button class="add-stay${quantityInCart ? ' added' : ''}" type="button" data-add-product="${product.id}" ${isBooked || atStockLimit ? 'disabled' : ''}>
              ${isBooked ? 'Fully booked' : atStockLimit ? 'Maximum added' : quantityInCart ? 'Add another' : 'Add to my stay'}
            </button>
          </div>
        </div>
      </article>`;
  }).join('');

  productGrid.hidden = filtered.length === 0;
  catalogueEmpty.hidden = filtered.length > 0;
  document.querySelector('#result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'offering' : 'offerings'}`;
}

function updateSuggestions() {
  const query = state.query.trim().toLowerCase();
  if (!query) {
    closeSuggestions();
    return;
  }
  const matches = products.filter(product => `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query)).slice(0, 5);
  if (!matches.length) {
    closeSuggestions();
    return;
  }
  suggestions.innerHTML = matches.map((product, index) => `
    <button type="button" role="option" aria-selected="false" data-suggestion="${product.name}" data-index="${index}">
      <span>${product.name}<small>${product.category}</small></span><strong>${money.format(product.price)}</strong>
    </button>`).join('');
  suggestions.hidden = false;
  productSearch.setAttribute('aria-expanded', 'true');
  activeSuggestionIndex = -1;
}

function closeSuggestions() {
  suggestions.hidden = true;
  productSearch.setAttribute('aria-expanded', 'false');
  activeSuggestionIndex = -1;
}

function openProductDetails(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  state.activeProductId = id;
  lastFocusedElement = document.activeElement;
  const quantityInCart = cartItemFor(id)?.quantity || 0;
  const remaining = Math.max(0, product.stock - quantityInCart);
  const image = document.querySelector('#product-dialog-image');
  image.className = `product-dialog-image ${product.imageClass}`;
  image.setAttribute('aria-label', `${product.name} at Sunset Resort`);
  document.querySelector('#product-dialog-category').textContent = product.category;
  const availability = document.querySelector('#product-dialog-availability');
  const availabilityLabel = productAvailability(product);
  availability.textContent = availabilityLabel;
  availability.className = `availability-badge ${availabilityClass(availabilityLabel)}`;
  document.querySelector('#product-dialog-title').textContent = product.name;
  document.querySelector('#product-dialog-price').textContent = money.format(product.price);
  document.querySelector('#product-dialog-unit').textContent = `/ ${product.unit}`;
  document.querySelector('#product-dialog-description').textContent = product.description;
  document.querySelector('#product-dialog-meta').innerHTML = product.details.map(detail => `<span>${detail}</span>`).join('');
  document.querySelector('#product-dialog-stock').textContent = product.stock === 0 ? 'Fully booked for the selected dates.' : `${remaining} of ${product.stock} still available to add.`;
  const addButton = document.querySelector('#product-dialog-add');
  addButton.dataset.addProduct = product.id;
  addButton.disabled = remaining === 0;
  addButton.textContent = product.stock === 0 ? 'Currently fully booked' : remaining === 0 ? 'Maximum added' : quantityInCart ? 'Add another to my stay' : 'Add to my stay';
  productDialog.showModal();
}

function closeProductDetails(restoreFocus = true) {
  if (productDialog.open) productDialog.close();
  state.activeProductId = null;
  if (restoreFocus) lastFocusedElement?.focus();
}

function selectSuggestion(value) {
  productSearch.value = value;
  state.query = value;
  document.querySelector('#search-clear-icon').hidden = false;
  closeSuggestions();
  renderProducts();
  productSearch.focus();
}

function moveSuggestion(direction) {
  const options = [...suggestions.querySelectorAll('[role="option"]')];
  if (!options.length || suggestions.hidden) return;
  activeSuggestionIndex = (activeSuggestionIndex + direction + options.length) % options.length;
  options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeSuggestionIndex)));
  options[activeSuggestionIndex].focus();
}

function clearCatalogueSearch(resetCategory = false) {
  productSearch.value = '';
  state.query = '';
  document.querySelector('#search-clear-icon').hidden = true;
  if (resetCategory) setCategory('All');
  closeSuggestions();
  renderProducts();
  productSearch.focus();
}

function setCategory(category) {
  state.category = category;
  document.querySelectorAll('[data-category]').forEach(button => {
    const selected = button.dataset.category === category;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderProducts();
}

function updateDateUI() {
  const arrival = safeDate(checkInInput.value);
  const departure = safeDate(checkOutInput.value);
  const guestText = `${guestInput.value} ${guestInput.value === '1' ? 'guest' : 'guests'}`;
  document.querySelector('#date-summary').textContent = arrival && departure ? `${dateLabel.format(arrival)} – ${dateLabel.format(departure)}` : 'your selected dates';
  document.querySelector('#guest-summary').textContent = guestText;
  document.querySelector('#cart-check-in').textContent = arrival ? dateLabel.format(arrival) : '—';
  document.querySelector('#cart-check-out').textContent = departure ? dateLabel.format(departure) : '—';
  document.querySelector('#cart-guests').textContent = guestInput.value;
  renderCart();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function openCart() {
  lastFocusedElement = document.activeElement;
  document.body.classList.add('cart-open');
  cart.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => document.querySelector('.cart-close').focus(), 50);
}

function closeCart() {
  document.body.classList.remove('cart-open');
  cart.setAttribute('aria-hidden', 'true');
  lastFocusedElement?.focus();
}

function addProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product || product.stock === 0) {
    showToast('This offering is currently fully booked.');
    return;
  }
  const existingItem = cartItemFor(id);
  if (existingItem && existingItem.quantity >= product.stock) {
    showToast(`Only ${product.stock} ${product.stock === 1 ? 'space is' : 'spaces are'} available.`);
    return;
  }
  if (existingItem) existingItem.quantity += 1;
  else state.items.push({ id, quantity: 1 });
  if (productDialog.open) closeProductDetails(false);
  saveCart();
  renderProducts();
  renderCart();
  showToast(`${product.name} added to your stay`);
  openCart();
}

function removeProduct(id) {
  const product = products.find(item => item.id === id);
  state.items = state.items.filter(item => item.id !== id);
  saveCart();
  renderProducts();
  renderCart();
  if (product) showToast(`${product.name} removed from your stay`);
}

function changeQuantity(id, change) {
  const product = products.find(item => item.id === id);
  const item = cartItemFor(id);
  if (!product || !item) return;
  const nextQuantity = item.quantity + change;
  if (nextQuantity < 1) return;
  if (nextQuantity > product.stock) {
    showToast(`Only ${product.stock} ${product.stock === 1 ? 'space is' : 'spaces are'} available.`);
    return;
  }
  item.quantity = nextQuantity;
  saveCart();
  renderProducts();
  renderCart();
}

function itemSubtotal(product, quantity) {
  return product.unit === 'night' ? product.price * getNights() * quantity : product.price * quantity;
}

function productCalculation(product, quantity) {
  if (product.unit === 'night') return `${money.format(product.price)} × ${getNights()} ${getNights() === 1 ? 'night' : 'nights'} × ${quantity} ${quantity === 1 ? 'room' : 'rooms'}`;
  return `${money.format(product.price)} × ${quantity} ${quantity === 1 ? 'guest' : 'guests'}`;
}

function getCartTotals() {
  const subtotal = state.items.reduce((sum, item) => {
    const product = products.find(productItem => productItem.id === item.id);
    return product ? sum + itemSubtotal(product, item.quantity) : sum;
  }, 0);
  const resortFees = state.items.reduce((sum, item) => {
    const product = products.find(productItem => productItem.id === item.id);
    return product?.unit === 'night' ? sum + RESORT_FEE_PER_ROOM_NIGHT * getNights() * item.quantity : sum;
  }, 0);
  const tax = Math.round((subtotal + resortFees) * TAX_RATE * 100) / 100;
  return { subtotal, resortFees, tax, grandTotal: subtotal + resortFees + tax };
}

function renderCart() {
  const selectedItems = state.items.map(item => ({ ...item, product: products.find(product => product.id === item.id) })).filter(item => item.product);
  const count = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count, .nav-cart-count').forEach(element => { element.textContent = count; });
  document.querySelectorAll('[data-open-cart]').forEach(button => button.setAttribute('aria-label', `Open booking cart, ${count} ${count === 1 ? 'item' : 'items'}`));
  cartItems.innerHTML = selectedItems.map(({ product, quantity }) => `
    <article class="cart-item">
      <div class="cart-item-image ${product.imageClass}" aria-hidden="true"></div>
      <div class="cart-item-content">
        <span class="cart-item-category">${product.category}</span><h3>${product.name}</h3><p>${productCalculation(product, quantity)}</p>
        <div class="cart-item-controls">
          <div class="quantity-control" aria-label="Quantity for ${product.name}">
            <button type="button" data-quantity-action="decrease" data-product-id="${product.id}" aria-label="Decrease ${product.name} quantity" ${quantity === 1 ? 'disabled' : ''}>−</button>
            <span aria-live="polite">${quantity}</span>
            <button type="button" data-quantity-action="increase" data-product-id="${product.id}" aria-label="Increase ${product.name} quantity" ${quantity >= product.stock ? 'disabled' : ''}>+</button>
          </div>
          <button class="remove-item" type="button" data-remove="${product.id}">Remove</button>
        </div>
      </div>
      <strong class="cart-line-subtotal">${money.format(itemSubtotal(product, quantity))}</strong>
    </article>`).join('');
  emptyCart.hidden = count > 0;
  cartFooter.hidden = count === 0;
  const totals = getCartTotals();
  document.querySelector('#cart-subtotal').textContent = money.format(totals.subtotal);
  document.querySelector('#cart-fees').textContent = money.format(totals.resortFees);
  document.querySelector('#cart-tax').textContent = money.format(totals.tax);
  document.querySelector('#cart-total').textContent = money.format(totals.grandTotal);
  document.querySelector('#night-count').textContent = `${getNights()} ${getNights() === 1 ? 'night' : 'nights'} · ${guestInput.value} ${guestInput.value === '1' ? 'guest' : 'guests'}`;
  if (checkoutDialog.open && !document.querySelector('#checkout-flow').hidden) renderCheckoutSummary();
}

function checkoutLineItems() {
  return state.items.map(item => ({ ...item, product: products.find(product => product.id === item.id) })).filter(item => item.product);
}

function renderCheckoutSummary() {
  const items = checkoutLineItems();
  const totals = getCartTotals();
  const arrival = safeDate(checkInInput.value);
  const departure = safeDate(checkOutInput.value);
  document.querySelector('#checkout-summary-dates').textContent = arrival && departure ? `${dateLabel.format(arrival)} – ${dateLabel.format(departure)}` : 'Dates not selected';
  document.querySelector('#checkout-summary-guests').textContent = `${guestInput.value} ${guestInput.value === '1' ? 'guest' : 'guests'}`;
  document.querySelector('#checkout-summary-items').innerHTML = items.map(({ product, quantity }) => `
    <article><div><strong>${product.name}</strong><span>${productCalculation(product, quantity)}</span></div><b>${money.format(itemSubtotal(product, quantity))}</b></article>`).join('');
  document.querySelector('#checkout-subtotal').textContent = money.format(totals.subtotal);
  document.querySelector('#checkout-fees').textContent = money.format(totals.resortFees);
  document.querySelector('#checkout-tax').textContent = money.format(totals.tax);
  document.querySelector('#checkout-total').textContent = money.format(totals.grandTotal);
}

function showCheckoutAlert(messages, type = 'error') {
  const alert = document.querySelector('#checkout-alert');
  const list = Array.isArray(messages) ? messages : [messages];
  if (!list.length) {
    alert.hidden = true;
    alert.textContent = '';
    alert.className = 'checkout-alert';
    return;
  }
  alert.className = `checkout-alert ${type}`;
  alert.innerHTML = list.length === 1 ? list[0] : `<strong>Please review these details:</strong><ul>${list.map(message => `<li>${message}</li>`).join('')}</ul>`;
  alert.hidden = false;
  alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setPaymentMethod(method) {
  const cardPanel = document.querySelector('#card-payment-panel');
  const mobilePanel = document.querySelector('#mobile-payment-panel');
  const cardSelected = method === 'card';
  cardPanel.hidden = !cardSelected;
  mobilePanel.hidden = cardSelected;
  cardPanel.querySelectorAll('input, select').forEach(field => { field.disabled = !cardSelected; });
  mobilePanel.querySelectorAll('input, select').forEach(field => { field.disabled = cardSelected; });
}

function openCheckout() {
  if (!state.items.length) {
    showToast('Add an offering before proceeding to checkout.');
    return;
  }
  const form = document.querySelector('#checkout-form');
  form.reset();
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.setAttribute('aria-invalid', 'false'));
  document.querySelector('#checkout-flow').hidden = false;
  document.querySelector('#receipt-view').hidden = true;
  showCheckoutAlert([]);
  if (state.currentUser) {
    document.querySelector('#checkout-name').value = state.currentUser.fullName;
    document.querySelector('#checkout-email').value = state.currentUser.email;
    document.querySelector('#checkout-phone').value = state.currentUser.phone;
    document.querySelector('#cardholder-name').value = state.currentUser.fullName;
  }
  document.querySelector('#checkout-checkin').min = checkInInput.min;
  document.querySelector('#checkout-checkin').value = checkInInput.value;
  setPaymentMethod('card');
  renderCheckoutSummary();
  closeCart();
  lastFocusedElement = document.querySelector('#checkout-button');
  checkoutDialog.showModal();
  window.setTimeout(() => document.querySelector('#checkout-name').focus(), 40);
}

function closeCheckout() {
  if (checkoutDialog.open) checkoutDialog.close();
  lastFocusedElement?.focus();
}

function validExpiry(value) {
  const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const expiry = new Date(year, month, 0, 23, 59, 59);
  return expiry >= new Date();
}

function validateCheckout() {
  const form = document.querySelector('#checkout-form');
  const paymentMethod = form.querySelector('[name="payment-method"]:checked').value;
  const errors = [];
  const invalidIds = [];
  const requireField = (id, message) => {
    const field = document.querySelector(`#${id}`);
    if (!field.value.trim()) { errors.push(message); invalidIds.push(id); }
  };
  requireField('checkout-name', 'Enter the guest’s full name.');
  requireField('checkout-email', 'Enter the guest’s email address.');
  requireField('checkout-phone', 'Enter the guest’s phone number.');
  requireField('checkout-street', 'Enter the stay or billing street address.');
  requireField('checkout-city', 'Enter the city.');
  requireField('checkout-country', 'Enter the country.');
  requireField('checkout-checkin', 'Choose a check-in date.');
  const email = document.querySelector('#checkout-email').value.trim();
  if (email && !validEmail(email)) { errors.push('Enter a valid email address.'); invalidIds.push('checkout-email'); }
  const checkin = safeDate(document.querySelector('#checkout-checkin').value);
  const minimum = safeDate(checkInInput.min);
  if (checkin && minimum && checkin < minimum) { errors.push('Check-in cannot be in the past.'); invalidIds.push('checkout-checkin'); }

  if (paymentMethod === 'card') {
    requireField('cardholder-name', 'Enter the cardholder name.');
    const cardNumber = document.querySelector('#card-number').value.replace(/\D/g, '');
    if (cardNumber.length < 13 || cardNumber.length > 19) { errors.push('Enter a valid 13–19 digit card number.'); invalidIds.push('card-number'); }
    if (!validExpiry(document.querySelector('#card-expiry').value.trim())) { errors.push('Enter a valid future card expiry in MM/YY format.'); invalidIds.push('card-expiry'); }
    if (!/^\d{3,4}$/.test(document.querySelector('#card-cvv').value.trim())) { errors.push('Enter a valid 3 or 4 digit CVV.'); invalidIds.push('card-cvv'); }
  } else {
    requireField('mobile-provider', 'Choose a mobile money provider.');
    const mobileNumber = document.querySelector('#mobile-number').value.replace(/\D/g, '');
    if (mobileNumber.length < 7 || mobileNumber.length > 15) { errors.push('Enter a valid mobile money number.'); invalidIds.push('mobile-number'); }
    if (!/^\d{4,6}$/.test(document.querySelector('#mobile-pin').value.trim())) { errors.push('Enter a 4–6 digit PIN or OTP for the simulation.'); invalidIds.push('mobile-pin'); }
  }
  form.querySelectorAll('input, select, textarea').forEach(field => field.setAttribute('aria-invalid', String(invalidIds.includes(field.id))));
  showCheckoutAlert(errors);
  return errors.length === 0;
}

function generateBookingReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const code = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `SSR-${date}-${code}`;
}

function storeBooking(booking) {
  try {
    const bookings = JSON.parse(localStorage.getItem(BOOKINGS_STORAGE_KEY) || '[]');
    bookings.push(booking);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
    return true;
  } catch {
    return false;
  }
}

function paymentDescription(method) {
  if (method === 'card') {
    const digits = document.querySelector('#card-number').value.replace(/\D/g, '');
    return `Card ending ${digits.slice(-4)}`;
  }
  return `${document.querySelector('#mobile-provider').value} mobile money`;
}

function renderReceipt(booking) {
  document.querySelector('#checkout-flow').hidden = true;
  document.querySelector('#receipt-view').hidden = false;
  document.querySelector('#receipt-guest').textContent = booking.customer.fullName;
  document.querySelector('#receipt-reference').textContent = booking.reference;
  document.querySelector('#receipt-details').innerHTML = `
    <p><span>Check-in</span><strong>${dateLabel.format(safeDate(booking.stay.checkIn))}</strong></p>
    <p><span>Check-out</span><strong>${dateLabel.format(safeDate(booking.stay.checkOut))}</strong></p>
    <p><span>Payment</span><strong>${booking.payment}</strong></p>
    <p><span>Location</span><strong>${booking.stay.city}, ${booking.stay.country}</strong></p>`;
  document.querySelector('#receipt-items').innerHTML = booking.items.map(item => `<p><span>${item.quantity} × ${item.name}</span><strong>${money.format(item.subtotal)}</strong></p>`).join('');
  document.querySelector('#receipt-total').textContent = money.format(booking.totals.grandTotal);
}

function simulateFailedPayment() {
  if (!validateCheckout()) return;
  showCheckoutAlert('Payment declined in the simulation. No charge was made and your cart is unchanged—review the details and retry.', 'decline');
}

async function simulateSuccessfulPayment() {
  if (!validateCheckout()) return;
  const unavailable = state.items.find(item => {
    const product = products.find(productItem => productItem.id === item.id);
    return !product || item.quantity > product.stock;
  });
  if (unavailable) {
    showCheckoutAlert('Availability changed before payment. Return to the cart and adjust the affected item.');
    return;
  }

  const form = document.querySelector('#checkout-form');
  const paymentMethod = form.querySelector('[name="payment-method"]:checked').value;
  const totals = getCartTotals();
  const booking = {
    reference: generateBookingReference(),
    createdAt: new Date().toISOString(),
    customer: {
      fullName: document.querySelector('#checkout-name').value.trim(),
      email: document.querySelector('#checkout-email').value.trim(),
      phone: document.querySelector('#checkout-phone').value.trim()
    },
    stay: {
      street: document.querySelector('#checkout-street').value.trim(),
      city: document.querySelector('#checkout-city').value.trim(),
      country: document.querySelector('#checkout-country').value.trim(),
      checkIn: checkInInput.value,
      checkOut: checkOutInput.value,
      notes: document.querySelector('#checkout-notes').value.trim()
    },
    items: checkoutLineItems().map(({ product, quantity }) => ({ id: product.id, apiId: product.apiId, name: product.name, quantity, subtotal: itemSubtotal(product, quantity) })),
    totals,
    payment: paymentDescription(paymentMethod)
  };

  const successButton = document.querySelector('#simulate-success');
  successButton.disabled = true;
  successButton.textContent = 'Processing simulation…';
  let apiOrder = null;
  try {
    const deliveryAddress = [
      booking.stay.street,
      booking.stay.city,
      booking.stay.country,
      `Check-in: ${booking.stay.checkIn}`,
      booking.stay.notes ? `Notes: ${booking.stay.notes}` : ''
    ].filter(Boolean).join(' | ');
    apiOrder = await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: booking.customer.fullName,
        customer_email: booking.customer.email,
        delivery_address: deliveryAddress,
        payment_method: booking.payment,
        nights: getNights(),
        items: booking.items.map(item => ({ product_id: item.apiId, quantity: item.quantity }))
      })
    });
  } catch (error) {
    if (!error.isNetwork && error.status !== 503) {
      showCheckoutAlert(error.message);
      if (error.status === 409) await syncProductsFromApi();
      successButton.disabled = false;
      successButton.textContent = 'Simulate Successful Payment';
      return;
    }
  }

  try {
    if (apiOrder) {
      booking.reference = apiOrder.order.booking_ref;
      booking.serverOrderId = apiOrder.order.id;
      booking.source = 'api';
      booking.totals = {
        subtotal: Number(apiOrder.totals.subtotal),
        resortFees: Number(apiOrder.totals.resort_fees),
        tax: Number(apiOrder.totals.tax),
        grandTotal: Number(apiOrder.totals.grand_total)
      };
      apiOrder.updated_products.forEach(update => {
        const product = products.find(item => item.apiId === Number(update.id));
        if (!product) return;
        product.stock = Number(update.stock_quantity);
        product.availability = update.availability_status;
      });
    } else {
      state.items.forEach(item => {
        const product = products.find(productItem => productItem.id === item.id);
        product.stock -= item.quantity;
      });
    }
    storeBooking(booking);
    saveInventory();
    state.items = [];
    saveCart();
    renderProducts();
    renderCart();
    renderReceipt(booking);
    document.querySelector('#card-number').value = '';
    document.querySelector('#card-cvv').value = '';
    document.querySelector('#mobile-pin').value = '';
    showToast(`Booking ${booking.reference} confirmed.`);
  } catch {
    showCheckoutAlert('The simulated payment could not be completed in this browser. Your cart has been kept intact.');
  } finally {
    successButton.disabled = false;
    successButton.textContent = 'Simulate Successful Payment';
  }
}

checkInInput.addEventListener('change', () => {
  if (!checkInInput.value) return;
  const nextDay = safeDate(checkInInput.value);
  nextDay.setDate(nextDay.getDate() + 1);
  checkOutInput.min = toISODate(nextDay);
  if (!checkOutInput.value || safeDate(checkOutInput.value) <= safeDate(checkInInput.value)) checkOutInput.value = toISODate(nextDay);
  updateDateUI();
});
checkOutInput.addEventListener('change', updateDateUI);
guestInput.addEventListener('change', updateDateUI);
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  updateDateUI();
  document.querySelector('#catalogue').scrollIntoView({ behavior: 'smooth' });
  showToast('Collection updated for your dates');
});

productSearch.addEventListener('input', () => {
  state.query = productSearch.value;
  document.querySelector('#search-clear-icon').hidden = !state.query;
  renderProducts();
  updateSuggestions();
});
productSearch.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); moveSuggestion(1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); moveSuggestion(-1); }
  if (event.key === 'Escape') closeSuggestions();
});
suggestions.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); moveSuggestion(1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); moveSuggestion(-1); }
  if (event.key === 'Escape') { closeSuggestions(); productSearch.focus(); }
  if (event.key === 'Enter') { event.preventDefault(); selectSuggestion(event.target.closest('[data-suggestion]')?.dataset.suggestion); }
});
suggestions.addEventListener('click', event => {
  const option = event.target.closest('[data-suggestion]');
  if (option) selectSuggestion(option.dataset.suggestion);
});
document.querySelector('#search-clear-icon').addEventListener('click', () => clearCatalogueSearch(false));
document.querySelector('#clear-search').addEventListener('click', () => clearCatalogueSearch(true));
document.querySelector('#category-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (button) setCategory(button.dataset.category);
});
document.querySelector('#price-range').addEventListener('change', event => {
  state.priceRange = event.target.value;
  renderProducts();
});
document.querySelector('#sort-by').addEventListener('change', event => {
  state.sortBy = event.target.value;
  renderProducts();
});
productGrid.addEventListener('click', event => {
  const detailsButton = event.target.closest('[data-view-product]');
  if (detailsButton) {
    openProductDetails(detailsButton.dataset.viewProduct);
    return;
  }
  const button = event.target.closest('[data-add-product]');
  if (button) addProduct(button.dataset.addProduct);
});

document.querySelectorAll('[data-open-cart]').forEach(button => button.addEventListener('click', openCart));
document.querySelectorAll('[data-close-cart]').forEach(button => button.addEventListener('click', closeCart));
cartItems.addEventListener('click', event => {
  const removeButton = event.target.closest('[data-remove]');
  if (removeButton) {
    removeProduct(removeButton.dataset.remove);
    return;
  }
  const quantityButton = event.target.closest('[data-quantity-action]');
  if (quantityButton) changeQuantity(quantityButton.dataset.productId, quantityButton.dataset.quantityAction === 'increase' ? 1 : -1);
});
document.querySelector('#product-dialog-add').addEventListener('click', event => addProduct(event.currentTarget.dataset.addProduct));
document.querySelector('[data-close-details]').addEventListener('click', () => closeProductDetails());
productDialog.addEventListener('click', event => {
  const bounds = productDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) closeProductDetails();
});
productDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeProductDetails();
});
menuToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navLinks.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));
document.addEventListener('click', event => {
  if (!event.target.closest('.product-search-wrap')) closeSuggestions();
});
document.querySelector('#checkout-button').addEventListener('click', openCheckout);
document.querySelectorAll('[name="payment-method"]').forEach(input => input.addEventListener('change', () => setPaymentMethod(input.value)));
document.querySelector('#checkout-checkin').addEventListener('change', event => {
  if (!event.target.value) return;
  const nights = getNights();
  const arrival = safeDate(event.target.value);
  const departure = new Date(arrival);
  departure.setDate(departure.getDate() + nights);
  checkInInput.value = event.target.value;
  checkOutInput.min = toISODate(new Date(arrival.getTime() + 86_400_000));
  checkOutInput.value = toISODate(departure);
  updateDateUI();
});
document.querySelector('#card-number').addEventListener('input', event => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 19);
  event.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
});
document.querySelector('#card-expiry').addEventListener('input', event => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
  event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
});
document.querySelector('#simulate-failure').addEventListener('click', simulateFailedPayment);
document.querySelector('#simulate-success').addEventListener('click', simulateSuccessfulPayment);
document.querySelector('[data-close-checkout]').addEventListener('click', closeCheckout);
document.querySelector('#receipt-done').addEventListener('click', closeCheckout);
checkoutDialog.addEventListener('click', event => {
  const bounds = checkoutDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) closeCheckout();
});
checkoutDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeCheckout();
});
document.querySelectorAll('[data-open-account]').forEach(control => control.addEventListener('click', event => {
  event.preventDefault();
  openAccountModal(control.dataset.accountDefault || 'register');
}));
document.querySelectorAll('#nav-logout, #account-logout').forEach(button => button.addEventListener('click', logOut));
document.querySelectorAll('[data-account-tab]').forEach(button => button.addEventListener('click', () => switchAccountTab(button.dataset.accountTab)));
document.querySelector('[data-close-account]').addEventListener('click', closeAccountModal);
accountDialog.addEventListener('click', event => {
  const bounds = accountDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) closeAccountModal();
});
accountDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeAccountModal();
});
document.querySelector('#register-form').addEventListener('submit', registerUser);
document.querySelector('#login-form').addEventListener('submit', logInUser);
document.querySelectorAll('[data-toggle-password]').forEach(button => button.addEventListener('click', () => {
  const input = document.querySelector(`#${button.dataset.togglePassword}`);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.classList.toggle('showing', !showing);
  button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (document.body.classList.contains('cart-open')) closeCart();
    navLinks.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

setInitialDates();
loadInventory();
loadCart();
loadSession();
renderProducts();
updateDateUI();
updateAccountUI();
syncProductsFromApi();
