const STORAGE_KEY = 'neighbourhood-tickets-demo-v1';

const organizerSeed = {
  id: 'org-1',
  display_name: 'Neighbourhood Association',
  email: 'organizer@neighbourhoodtickets.local',
  password_hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  role: 'organizer',
};

function todayISO() {
  return new Date().toISOString().slice(0, 16);
}

function dateTimeLocalValue(date) {
  if (!date) return '';
  const value = new Date(date);
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function safeText(value) {
  return String(value ?? '').trim();
}

function createSeedState() {
  const now = new Date();
  const start = new Date(now.getTime() + 1000 * 60 * 60 * 48);
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 2);
  const regDeadline = new Date(start.getTime() - 1000 * 60 * 60 * 24);

  return {
    organizer: organizerSeed,
    activeSession: null,
    lastOrder: null,
    emailLog: [],
    events: [
      {
        id: 'event-neighbourhood-skills-night',
        slug: 'neighbourhood-skills-night',
        title: 'Neighbourhood Skills Night',
        summary: 'A free evening workshop focused on practical neighbourhood support, basic digital confidence, and community learning.',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        venue: 'Community Hall',
        capacity: 80,
        registration_deadline: regDeadline.toISOString(),
        contact_email: 'organizer@neighbourhoodtickets.local',
        status: 'Published',
        created_at: now.toISOString(),
      },
    ],
    orders: [],
    checkins: [],
  };
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seed = createSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    const seed = createSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function getEventBySlug(slug) {
  return state.events.find((event) => event.slug === slug) || null;
}

function getPublishedEvent() {
  return state.events.find((event) => event.status === 'Published') || null;
}

function getEventById(eventId) {
  return state.events.find((event) => event.id === eventId) || null;
}

function getRemainingTickets(event) {
  if (!event) return 0;
  const confirmed = state.orders
    .filter((order) => order.event_id === event.id && order.status === 'Confirmed')
    .reduce((total, order) => total + Number(order.quantity || 0), 0);
  return Math.max(Number(event.capacity) - confirmed, 0);
}

function getCheckedInCount(eventId) {
  return state.checkins.filter((checkin) => {
    const order = state.orders.find((item) => item.id === checkin.order_id);
    return Boolean(order && order.event_id === eventId);
  }).length;
}

function getOrderById(orderId) {
  return state.orders.find((order) => order.id === orderId) || null;
}

function getEventTotals(eventId) {
  const event = getEventById(eventId);
  if (!event) {
    return { capacity: 0, confirmed: 0, remaining: 0, checked_in_orders: 0, checked_in_guests: 0 };
  }

  const orders = state.orders.filter((order) => order.event_id === eventId && order.status === 'Confirmed');
  const confirmed = orders.reduce((total, order) => total + Number(order.quantity || 0), 0);
  const checkedInOrders = state.checkins.filter((checkin) => {
    const order = state.orders.find((item) => item.id === checkin.order_id);
    return Boolean(order && order.event_id === eventId);
  }).length;

  const checkedInGuests = state.checkins.reduce((total, checkin) => {
    const order = state.orders.find((item) => item.id === checkin.order_id);
    return total + (order && order.event_id === eventId ? Number(order.quantity || 0) : 0);
  }, 0);

  return {
    capacity: Number(event.capacity || 0),
    confirmed,
    remaining: Math.max(Number(event.capacity) - confirmed, 0),
    checked_in_orders: checkedInOrders,
    checked_in_guests: checkedInGuests,
  };
}

function baseRoute() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/')) return hash.slice(2) || '/';
  return '/';
}

function setRoute(route) {
  window.location.hash = route;
  render();
}

function redirectToPublicEvent() {
  const event = getPublishedEvent();
  if (event) setRoute(`#/event/${event.slug}`);
}

function getCurrentRoute() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/event/')) return 'event';
  if (hash === '#/login') return 'login';
  if (hash === '#/dashboard') return 'dashboard';
  if (hash === '#/checkin') return 'checkin';
  if (hash === '#/confirmation') return 'confirmation';
  return 'home';
}

function isOrganizerLoggedIn() {
  return Boolean(state.activeSession && state.activeSession.organizerId === organizerSeed.id);
}

function renderPublicEvent() {
  const event = getPublishedEvent();
  const root = document.getElementById('app');
  if (!event) {
    const cancelledEvent = state.events.find((item) => item.status === 'Cancelled') || null;
    if (cancelledEvent) {
      root.innerHTML = `
        <section class="panel">
          <p class="eyebrow accent">Event status</p>
          <h2>${safeText(cancelledEvent.title)}</h2>
          <p class="message-box error visible">This event has been cancelled. Registration is closed and the organizer retains the attendee history.</p>
          <dl class="detail-list">
            <div><dt>Starts</dt><dd>${formatDateTime(cancelledEvent.starts_at)}</dd></div>
            <div><dt>Venue</dt><dd>${safeText(cancelledEvent.venue)}</dd></div>
            <div><dt>Contact</dt><dd>${safeText(cancelledEvent.contact_email)}</dd></div>
          </dl>
        </section>
      `;
      return;
    }

    root.innerHTML = `
      <section class="panel">
        <p class="eyebrow accent">Event status</p>
        <h2>No public event available</h2>
        <p>The organizer has not published an event yet. Please return later or sign in to create one.</p>
      </section>
    `;
    return;
  }

  root.innerHTML = document.getElementById('public-event-template').innerHTML;

  const titleEl = document.getElementById('event-title');
  const summaryEl = document.getElementById('event-summary');
  const metaList = document.getElementById('event-meta-list');
  const details = document.getElementById('event-details');
  const statusBox = document.getElementById('capacity-status');

  titleEl.textContent = event.title;
  summaryEl.textContent = event.summary;
  metaList.innerHTML = `
    <li>${formatDateTime(event.starts_at)}</li>
    <li>${safeText(event.venue)}</li>
    <li>Free entry</li>
  `;

  const remaining = getRemainingTickets(event);
  const totalConfirmed = state.orders
    .filter((order) => order.event_id === event.id && order.status === 'Confirmed')
    .reduce((sum, order) => sum + Number(order.quantity || 0), 0);

  statusBox.innerHTML = `
    <div class="capacity-value">${remaining}</div>
    <p class="capacity-detail">${remaining} tickets remaining of ${event.capacity}</p>
    <p class="capacity-detail">${totalConfirmed} confirmed tickets</p>
  `;

  details.innerHTML = `
    <div>
      <dt>Starts</dt>
      <dd>${formatDateTime(event.starts_at)}</dd>
    </div>
    <div>
      <dt>Ends</dt>
      <dd>${formatDateTime(event.ends_at)}</dd>
    </div>
    <div>
      <dt>Venue</dt>
      <dd>${safeText(event.venue)}</dd>
    </div>
    <div>
      <dt>Registration closes</dt>
      <dd>${formatDateTime(event.registration_deadline)}</dd>
    </div>
    <div>
      <dt>Contact</dt>
      <dd>${safeText(event.contact_email)}</dd>
    </div>
    <div>
      <dt>Capacity</dt>
      <dd>${event.capacity} seats</dd>
    </div>
  `;

  const registerForm = document.getElementById('registration-form');
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const name = safeText(formData.get('name'));
    const email = safeText(formData.get('email'));
    const quantity = Number(formData.get('quantity') || 1);
    const message = document.getElementById('registration-message');
    const eventForRegistration = getPublishedEvent();

    if (!eventForRegistration) {
      showMessage(message, 'This event is unavailable.', 'error');
      return;
    }

    if (eventForRegistration.status === 'Cancelled') {
      showMessage(message, 'This event has been cancelled and registration is closed.', 'error');
      return;
    }

    if (!name || !email) {
      showMessage(message, 'Name and email are required to reserve tickets.', 'error');
      return;
    }

    if (quantity < 1 || quantity > 4) {
      showMessage(message, 'Tickets must be between 1 and 4.', 'error');
      return;
    }

    const now = new Date();
    const regDeadline = new Date(eventForRegistration.registration_deadline);
    if (now > regDeadline) {
      showMessage(message, 'Registration is closed for this event.', 'error');
      return;
    }

    const confirmedTotal = state.orders
      .filter((order) => order.event_id === eventForRegistration.id && order.status === 'Confirmed')
      .reduce((sum, order) => sum + Number(order.quantity || 0), 0);

    if (confirmedTotal + quantity > Number(eventForRegistration.capacity)) {
      showMessage(message, `Only ${Math.max(Number(eventForRegistration.capacity) - confirmedTotal, 0)} tickets remain.`, 'error');
      return;
    }

    const existingCodes = state.orders.map((order) => order.ticket_code).filter(Boolean);
    const ticketCode = generateTicketCode(existingCodes);
    const codeHash = await hashTicketCode(ticketCode);

    const order = {
      id: `order-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      event_id: eventForRegistration.id,
      attendee_name: name,
      attendee_email: email,
      quantity,
      ticket_code: ticketCode,
      ticket_code_hash: codeHash,
      status: 'Confirmed',
      email_status: 'sent',
      created_at: new Date().toISOString(),
    };

    state.orders.push(order);
    state.lastOrder = order;
    saveState();

    const emailLog = {
      order_id: order.id,
      recipient: email,
      event_id: eventForRegistration.id,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
    state.emailLog.push(emailLog);
    saveState();

    setRoute('#/confirmation');
  });
}

function renderLogin() {
  const root = document.getElementById('app');
  root.innerHTML = document.getElementById('login-template').innerHTML;

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = safeText(formData.get('email')).toLowerCase();
    const password = safeText(formData.get('password'));
    const message = document.getElementById('login-message');

    const passwordHash = await hashText(password);
    if (email === organizerSeed.email.toLowerCase() && passwordHash === organizerSeed.password_hash) {
      state.activeSession = { organizerId: organizerSeed.id, email, signedInAt: new Date().toISOString() };
      saveState();
      showMessage(message, 'Signed in successfully.', 'success');
      setTimeout(() => setRoute('#/dashboard'), 250);
      return;
    }

    showMessage(message, 'Invalid email or password.', 'error');
  });
}

function renderDashboard() {
  if (!isOrganizerLoggedIn()) {
    setRoute('#/login');
    return;
  }

  const root = document.getElementById('app');
  root.innerHTML = document.getElementById('dashboard-template').innerHTML;

  const statsGrid = document.getElementById('stats-grid');
  const eventList = document.getElementById('event-list');

  const eventStats = state.events.map((event) => {
    const totals = getEventTotals(event.id);
    return {
      event,
      totals,
    };
  });

  statsGrid.innerHTML = eventStats
    .map(({ event, totals }) => `
      <article class="stats-card">
        <p class="stat-label">${event.title}</p>
        <p class="stat-value">${totals.confirmed}</p>
        <p class="capacity-detail">${totals.remaining} remaining / capacity ${event.capacity}</p>
      </article>
    `)
    .join('') || '<p class="capacity-detail">No events yet.</p>';

  eventList.innerHTML = state.events
    .map((event) => {
      const totals = getEventTotals(event.id);
      return `
        <article class="event-item">
          <div class="event-item-header">
            <h4>${event.title}</h4>
            <span class="event-status ${event.status === 'Cancelled' ? 'cancelled' : ''}">${event.status}</span>
          </div>
          <p>${event.summary}</p>
          <p>${formatDateTime(event.starts_at)} • ${safeText(event.venue)} • ${totals.remaining} seats left</p>
          <div class="event-item-actions">
            <button class="action-button" type="button" data-action="edit-event" data-event-id="${event.id}">Edit</button>
            <button class="action-button" type="button" data-action="publish-event" data-event-id="${event.id}" ${event.status === 'Published' ? 'disabled' : ''}>Publish</button>
            <button class="action-button" type="button" data-action="export-event" data-event-id="${event.id}">Export CSV</button>
            <button class="action-button-danger" type="button" data-action="cancel-event" data-event-id="${event.id}" ${event.status === 'Cancelled' ? 'disabled' : ''}>Cancel</button>
          </div>
        </article>
      `;
    })
    .join('');

  document.getElementById('logout-button').addEventListener('click', () => {
    state.activeSession = null;
    saveState();
    setRoute('#/login');
  });

  document.getElementById('reset-event-form').addEventListener('click', () => {
    const emptyValues = {
      id: '',
      title: '',
      summary: '',
      starts_at: dateTimeLocalValue(new Date(Date.now() + 1000 * 60 * 60 * 72)),
      ends_at: dateTimeLocalValue(new Date(Date.now() + 1000 * 60 * 60 * 74)),
      venue: 'Community Hall',
      capacity: 80,
      registration_deadline: dateTimeLocalValue(new Date(Date.now() + 1000 * 60 * 60 * 48)),
      contact_email: organizerSeed.email,
    };

    Object.entries(emptyValues).forEach(([key, value]) => {
      const el = document.getElementById(key === 'id' ? 'event-id' : `event-${key === 'title' ? 'title-input' : key === 'summary' ? 'summary-input' : key === 'starts_at' ? 'starts-at' : key === 'ends_at' ? 'ends-at' : key === 'capacity' ? 'capacity' : key === 'registration_deadline' ? 'registration-deadline' : key === 'contact_email' ? 'contact-email' : 'venue'}`);
      if (el) el.value = value;
    });
  });

  document.getElementById('event-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = document.getElementById('event-form-message');
    const id = safeText(formData.get('id')) || `event-${Date.now()}`;
    const title = safeText(formData.get('title'));
    const summary = safeText(formData.get('summary'));
    const startsAt = safeText(formData.get('starts_at'));
    const endsAt = safeText(formData.get('ends_at'));
    const venue = safeText(formData.get('venue'));
    const capacity = Number(formData.get('capacity'));
    const registrationDeadline = safeText(formData.get('registration_deadline'));
    const contactEmail = safeText(formData.get('contact_email'));

    if (!title || !summary || !startsAt || !endsAt || !venue || !registrationDeadline || !contactEmail) {
      showMessage(message, 'All event fields are required.', 'error');
      return;
    }

    if (capacity < 1 || capacity > 500) {
      showMessage(message, 'Capacity must be between 1 and 500 seats.', 'error');
      return;
    }

    const startDt = new Date(startsAt);
    const endDt = new Date(endsAt);
    const deadlineDt = new Date(registrationDeadline);

    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime()) || Number.isNaN(deadlineDt.getTime())) {
      showMessage(message, 'Event dates must be valid.', 'error');
      return;
    }

    if (deadlineDt > startDt || startDt >= endDt) {
      showMessage(message, 'Registration deadline must be before the event start and the end time must be later than the start time.', 'error');
      return;
    }

    const existing = state.events.find((item) => item.id === id);
    if (existing) {
      existing.title = title;
      existing.summary = summary;
      existing.starts_at = new Date(startsAt).toISOString();
      existing.ends_at = new Date(endsAt).toISOString();
      existing.venue = venue;
      existing.capacity = capacity;
      existing.registration_deadline = new Date(registrationDeadline).toISOString();
      existing.contact_email = contactEmail;
      showMessage(message, 'Event updated successfully.', 'success');
    } else {
      const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'new-event';
      state.events.push({
        id,
        slug,
        title,
        summary,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        venue,
        capacity,
        registration_deadline: new Date(registrationDeadline).toISOString(),
        contact_email: contactEmail,
        status: 'Draft',
        created_at: new Date().toISOString(),
      });
      showMessage(message, 'Draft saved successfully.', 'success');
    }

    saveState();
    renderDashboard();
  });

  eventList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.action;
      const eventId = button.dataset.eventId;
      const currentEvent = getEventById(eventId);

      if (!currentEvent) return;

      if (type === 'edit-event') {
        const form = document.getElementById('event-form');
        form.elements['event-id'].value = currentEvent.id;
        form.elements['event-title-input'].value = currentEvent.title;
        form.elements['event-summary-input'].value = currentEvent.summary;
        form.elements['event-starts-at'].value = dateTimeLocalValue(currentEvent.starts_at);
        form.elements['event-ends-at'].value = dateTimeLocalValue(currentEvent.ends_at);
        form.elements['event-venue'].value = currentEvent.venue;
        form.elements['event-capacity'].value = currentEvent.capacity;
        form.elements['event-registration-deadline'].value = dateTimeLocalValue(currentEvent.registration_deadline);
        form.elements['event-contact-email'].value = currentEvent.contact_email;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (type === 'publish-event') {
        const now = new Date();
        if (new Date(currentEvent.registration_deadline) <= now || new Date(currentEvent.starts_at) <= now) {
          window.alert('This event must have a valid future date and a registration deadline before the start time before it can be published.');
          return;
        }
        currentEvent.status = 'Published';
        currentEvent.slug = currentEvent.slug || currentEvent.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        saveState();
        renderDashboard();
        return;
      }

      if (type === 'cancel-event') {
        const confirmed = window.confirm(`Cancel ${currentEvent.title}? Registration will close, but past records will remain visible to the organizer.`);
        if (!confirmed) return;
        currentEvent.status = 'Cancelled';
        saveState();
        renderDashboard();
        return;
      }

      if (type === 'export-event') {
        const rows = state.orders.filter((order) => order.event_id === currentEvent.id);
        const csv = [
          ['name', 'email', 'quantity', 'status', 'ticket_code', 'checked_in_at'],
          ...rows.map((order) => {
            const checkin = state.checkins.find((item) => item.order_id === order.id);
            return [
              order.attendee_name,
              order.attendee_email,
              order.quantity,
              order.status,
              order.ticket_code,
              checkin ? checkin.checked_in_at : '',
            ];
          }),
        ]
          .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentEvent.slug || currentEvent.id}-attendees.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    });
  });
}

function renderCheckin() {
  if (!isOrganizerLoggedIn()) {
    setRoute('#/login');
    return;
  }

  const root = document.getElementById('app');
  root.innerHTML = document.getElementById('checkin-template').innerHTML;

  const eventSelect = document.getElementById('checkin-event-select');
  eventSelect.innerHTML = state.events
    .filter((event) => event.status !== 'Draft')
    .map((event) => `<option value="${event.id}">${event.title}</option>`)
    .join('');

  const queryInput = document.getElementById('checkin-query');
  const messageBox = document.getElementById('checkin-message');
  const resultsBox = document.getElementById('checkin-results');

  const renderResults = () => {
    const selectedEventId = eventSelect.value;
    const q = queryInput.value.trim().toLowerCase();
    const event = getEventById(selectedEventId);
    if (!event) {
      resultsBox.innerHTML = '<p>No event selected.</p>';
      return;
    }

    const filteredOrders = state.orders.filter((order) => {
      const matchesEvent = order.event_id === event.id;
      if (!matchesEvent) return false;
      if (!q) return true;
      const value = `${order.attendee_name} ${order.attendee_email} ${order.ticket_code}`.toLowerCase();
      return value.includes(q);
    });

    if (!filteredOrders.length) {
      resultsBox.innerHTML = '<p>No matching attendee records for this event.</p>';
      return;
    }

    resultsBox.innerHTML = filteredOrders
      .map((order) => {
        const checkin = state.checkins.find((item) => item.order_id === order.id);
        const isCheckedIn = Boolean(checkin);
        return `
          <article class="checkin-row">
            <div class="checkin-row-header">
              <strong>${safeText(order.attendee_name)}</strong>
              <span class="tag ${isCheckedIn ? 'status-checked' : ''}">${isCheckedIn ? 'Checked in' : 'Awaiting check-in'}</span>
            </div>
            <p>${safeText(order.attendee_email)}</p>
            <p>Ticket code: ${safeText(order.ticket_code)}</p>
            <p>Quantity: ${order.quantity}</p>
            <p>${isCheckedIn ? `Checked in at ${formatDateTime(checkin.checked_in_at)} by ${safeText(checkin.checked_in_by)}` : 'Not checked in yet.'}</p>
            <button class="primary-button" type="button" data-order-id="${order.id}" ${isCheckedIn ? 'disabled' : ''}>Check in</button>
          </article>
        `;
      })
      .join('');

    resultsBox.querySelectorAll('[data-order-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const order = getOrderById(button.dataset.orderId);
        if (!order) return;

        const existing = state.checkins.find((checkin) => checkin.order_id === order.id);
        if (existing) {
          showMessage(messageBox, `This order is already checked in at ${formatDateTime(existing.checked_in_at)}.`, 'success');
          renderResults();
          return;
        }

        state.checkins.push({
          id: `checkin-${Date.now()}`,
          order_id: order.id,
          checked_in_at: new Date().toISOString(),
          checked_in_by: organizerSeed.email,
        });
        saveState();
        showMessage(messageBox, `Checked in ${order.attendee_name}.`, 'success');
        renderResults();
      });
    });
  };

  eventSelect.addEventListener('change', renderResults);
  queryInput.addEventListener('input', renderResults);
  renderResults();

  document.getElementById('checkin-logout-button').addEventListener('click', () => {
    state.activeSession = null;
    saveState();
    setRoute('#/login');
  });
}

function renderConfirmation() {
  const order = state.lastOrder;
  const root = document.getElementById('app');
  if (!order) {
    root.innerHTML = `
      <section class="panel">
        <p class="eyebrow accent">No confirmation found</p>
        <h2>No active ticket</h2>
        <p>Your order does not appear in the current session. Please return to the event page.</p>
      </section>
    `;
    return;
  }

  const event = getEventById(order.event_id);
  root.innerHTML = document.getElementById('confirmation-template').innerHTML;
  const wrapper = document.getElementById('confirmation-details');
  wrapper.innerHTML = `
    <div class="ticket-panel">
      <h3>${event ? event.title : 'Event registration'}</h3>
      <p><strong>Attendee:</strong> ${safeText(order.attendee_name)}</p>
      <p><strong>Email:</strong> ${safeText(order.attendee_email)}</p>
      <p><strong>Tickets:</strong> ${order.quantity}</p>
      <p><strong>Email status:</strong> ${order.email_status}</p>
      <div class="ticket-code">${safeText(order.ticket_code)}</div>
      <p>Keep this code for check-in at the venue.</p>
    </div>
  `;

  document.querySelector('[data-route="#/"]').addEventListener('click', () => setRoute('#/'));
}

function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.classList.remove('visible', 'error', 'success');
  element.classList.add(type, 'visible');
}

function generateTicketCode(existingCodes = []) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const cryptoObject = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null);

  let ticketCode = '';
  do {
    const values = new Uint32Array(12);
    if (cryptoObject && cryptoObject.getRandomValues) {
      cryptoObject.getRandomValues(values);
    } else {
      for (let index = 0; index < values.length; index += 1) {
        values[index] = Math.floor(Math.random() * 1000000000);
      }
    }

    const code = Array.from(values)
      .map((value) => alphabet[value % alphabet.length])
      .join('');
    ticketCode = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  } while (ticketCode && existingCodes.includes(ticketCode));

  return ticketCode;
}

async function hashTicketCode(value) {
  const text = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', text);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashText(value) {
  if (!window.crypto || !window.crypto.subtle) {
    return value;
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function attachGlobalNavigation() {
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => {
      const route = button.dataset.route;
      if (route) setRoute(route);
    });
  });
}

function render() {
  attachGlobalNavigation();
  const route = getCurrentRoute();
  if (route === 'dashboard') {
    renderDashboard();
    return;
  }

  if (route === 'checkin') {
    renderCheckin();
    return;
  }

  if (route === 'login') {
    renderLogin();
    return;
  }

  if (route === 'confirmation') {
    renderConfirmation();
    return;
  }

  if (route === 'event') {
    const slug = window.location.hash.replace('#/event/', '');
    const event = getEventBySlug(slug);
    if (!event) {
      renderPublicEvent();
      return;
    }
    renderPublicEvent();
    return;
  }

  renderPublicEvent();
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash) {
    const event = getPublishedEvent();
    if (event) {
      setRoute(`#/event/${event.slug}`);
      return;
    }
  }
  render();
});

if (window.crypto && !window.crypto.subtle) {
  console.warn('Secure crypto API unavailable in this browser.');
}
