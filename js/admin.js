/* ============================================================
   WYTU ADMIN JS (js/admin.js) - Supabase version
   Requires js/supabase-client.js (eventService, storageService, sb)
   ============================================================ */

const authService = {
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data.user;
  },

  async logout() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
  },

  async getCurrentUser() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.user : null;
  },

  // Returns true if logged in, otherwise redirects to login
  async requireAuth() {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
};

function resolveAdminImagePath(path) {
  if (!path) return '../images/events/sample-1.svg';
  if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('blob:')) return path;
  const cleanPath = path.replace(/^(\.\.\/|\.\/)+/, '');
  return `../${cleanPath}`;
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('admin-login-form')) {
    initAdminLoginPage();
    return;
  }

  const needsAuth = document.getElementById('admin-dashboard-stats') ||
    document.getElementById('admin-events-table-body') ||
    document.getElementById('admin-create-event-form') ||
    document.getElementById('admin-edit-event-form');
  if (!needsAuth) return;

  if (!(await authService.requireAuth())) return;
  await initAdminHeaderUser();

  try {
    if (document.getElementById('admin-dashboard-stats')) await initAdminDashboard();
    if (document.getElementById('admin-events-table-body')) await initAdminEventsList();
    if (document.getElementById('admin-create-event-form')) initAdminCreateEventForm();
    if (document.getElementById('admin-edit-event-form')) await initAdminEditEventForm();
  } catch (err) {
    console.error(err);
    alert('Something went wrong talking to the database: ' + err.message);
  }
});

async function initAdminHeaderUser() {
  const userNameEl = document.querySelector('.admin-user-name');
  const logoutBtn = document.querySelector('.btn-admin-logout');
  const user = await authService.getCurrentUser();
  if (userNameEl && user) userNameEl.textContent = user.email;
  if (logoutBtn) logoutBtn.addEventListener('click', () => authService.logout());
}

function initAdminLoginPage() {
  const form = document.getElementById('admin-login-form');
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const passInput = document.getElementById('admin-password-input');
  const alertEl = document.getElementById('admin-login-alert');

  // Already logged in? Skip the login page.
  authService.getCurrentUser().then(u => { if (u) window.location.href = 'index.html'; });

  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passInput.setAttribute('type', type);
      togglePassBtn.textContent = type === 'password' ? '👁️ Show' : '🙈 Hide';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email-input').value.trim();
    const password = passInput.value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.className = 'admin-alert';
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      await authService.login(email, password);
      window.location.href = 'index.html';
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = err.message;
        alertEl.className = 'admin-alert admin-alert-danger';
        alertEl.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login to Dashboard';
    }
  });
}

async function initAdminDashboard() {
  const allEvents = await eventService.getAllEvents();
  const publishedCount = allEvents.filter(e => e.status === 'published').length;
  const draftCount = allEvents.filter(e => e.status === 'draft').length;

  const totalEl = document.getElementById('stat-total-events');
  const pubEl = document.getElementById('stat-published-events');
  const draftEl = document.getElementById('stat-draft-events');
  const recentTableBody = document.getElementById('admin-recent-events-body');

  if (totalEl) totalEl.textContent = allEvents.length;
  if (pubEl) pubEl.textContent = publishedCount;
  if (draftEl) draftEl.textContent = draftCount;

  if (!recentTableBody) return;
  const recent = allEvents.slice(0, 5);
  if (recent.length === 0) {
    recentTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No events found.</td></tr>`;
    return;
  }

  recentTableBody.innerHTML = recent.map(evt => {
    const thumb = resolveAdminImagePath(evt.images && evt.images[0]);
    return `
      <tr>
        <td><img src="${thumb}" class="admin-table-thumb" alt="${escapeHTML(evt.title)}" /></td>
        <td><strong>${escapeHTML(evt.title)}</strong></td>
        <td>${escapeHTML(evt.date)}</td>
        <td><span class="badge badge-${evt.status}">${evt.status}</span></td>
        <td><a href="edit-event.html?id=${evt.id}" class="btn-action btn-action-edit">Edit</a></td>
      </tr>`;
  }).join('');
}

async function initAdminEventsList() {
  const tableBody = document.getElementById('admin-events-table-body');
  const statusFilter = document.getElementById('admin-status-filter');
  const deleteModal = document.getElementById('delete-modal');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

  let pendingDeleteId = null;
  let allEvents = await eventService.getAllEvents();

  function renderTable() {
    let events = allEvents;
    const filterVal = statusFilter ? statusFilter.value : 'all';
    if (filterVal !== 'all') events = events.filter(e => e.status === filterVal);

    if (events.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">No events found matching the selected status.</td></tr>`;
      return;
    }

    tableBody.innerHTML = events.map(evt => {
      const thumb = resolveAdminImagePath(evt.images && evt.images[0]);
      return `
        <tr>
          <td><img src="${thumb}" class="admin-table-thumb" alt="${escapeHTML(evt.title)}" /></td>
          <td>
            <div style="font-weight:700; color:var(--navy);">${escapeHTML(evt.title)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHTML(evt.location)}</div>
          </td>
          <td>${escapeHTML(evt.date)}</td>
          <td><span class="badge badge-navy">${escapeHTML(evt.category)}</span></td>
          <td><span class="badge badge-${evt.status}">${evt.status}</span></td>
          <td>
            <div class="action-btns">
              <button type="button" class="btn-action btn-action-toggle" data-action="toggle-status" data-id="${evt.id}">
                ${evt.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <a href="edit-event.html?id=${evt.id}" class="btn-action btn-action-edit">Edit</a>
              <button type="button" class="btn-action btn-action-delete" data-action="trigger-delete" data-id="${evt.id}">Delete</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tableBody.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          await eventService.togglePublishStatus(e.target.getAttribute('data-id'));
          allEvents = await eventService.getAllEvents();
          renderTable();
        } catch (err) { alert('Failed: ' + err.message); e.target.disabled = false; }
      });
    });

    tableBody.querySelectorAll('[data-action="trigger-delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        pendingDeleteId = e.target.getAttribute('data-id');
        if (deleteModal) deleteModal.classList.add('active');
      });
    });
  }

  if (statusFilter) statusFilter.addEventListener('change', renderTable);

  if (cancelDeleteBtn && deleteModal) {
    cancelDeleteBtn.addEventListener('click', () => {
      pendingDeleteId = null;
      deleteModal.classList.remove('active');
    });
  }

  if (confirmDeleteBtn && deleteModal) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      confirmDeleteBtn.disabled = true;
      try {
        await eventService.deleteEvent(pendingDeleteId);
        allEvents = await eventService.getAllEvents();
      } catch (err) { alert('Delete failed: ' + err.message); }
      pendingDeleteId = null;
      confirmDeleteBtn.disabled = false;
      deleteModal.classList.remove('active');
      renderTable();
    });
  }

  renderTable();
}

/* ---------- Shared image picker for create + edit forms ----------
   Items are { url } for already-uploaded images, or { file, url: blobPreview }
   for newly chosen files that get uploaded when the form is saved. */
function setupImagePicker({ initialUrls = [], errorAlert }) {
  const fileInput = document.getElementById('event-images-input');
  const previewGrid = document.getElementById('image-preview-grid');
  const items = initialUrls.map(url => ({ url }));

  function render() {
    if (!previewGrid) return;
    previewGrid.innerHTML = '';
    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'preview-card';
      card.innerHTML = `
        <img src="${resolveAdminImagePath(item.url)}" alt="Preview ${idx + 1}" />
        <button type="button" class="btn-remove-img" title="Remove image">&times;</button>`;
      card.querySelector('.btn-remove-img').addEventListener('click', () => {
        items.splice(idx, 1);
        render();
      });
      previewGrid.appendChild(card);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (errorAlert) errorAlert.style.display = 'none';

      if (items.length + files.length > 3) {
        showError(errorAlert, 'Maximum 3 images allowed per event announcement.');
        fileInput.value = '';
        return;
      }
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          showError(errorAlert, 'Invalid file type. Only JPG, PNG, and WEBP images are allowed.');
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          showError(errorAlert, `"${file.name}" exceeds the 5MB limit.`);
          continue;
        }
        items.push({ file, url: URL.createObjectURL(file) });
      }
      render();
      fileInput.value = '';
    });
  }

  render();

  return {
    count: () => items.length,
    // Uploads new files, returns the final array of public URLs
    async resolveUrls() {
      const urls = [];
      for (const item of items) {
        urls.push(item.file ? await storageService.uploadImage(item.file) : item.url);
      }
      return urls;
    }
  };
}

function readEventForm() {
  return {
    title: document.getElementById('event-title').value.trim(),
    description: document.getElementById('event-description').value.trim(),
    fullContent: document.getElementById('event-full-content').value.trim(),
    date: document.getElementById('event-date').value,
    time: document.getElementById('event-time').value.trim(),
    location: document.getElementById('event-location').value.trim(),
    category: document.getElementById('event-category').value,
    status: document.getElementById('event-status').value
  };
}

function initAdminCreateEventForm() {
  const form = document.getElementById('admin-create-event-form');
  const errorAlert = document.getElementById('form-error-alert');
  const picker = setupImagePicker({ errorAlert });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readEventForm();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!data.title || !data.description || !data.date || !data.time || !data.location) {
      return showError(errorAlert, 'Please fill out all required fields marked with *');
    }
    if (picker.count() === 0) {
      return showError(errorAlert, 'Please add at least 1 event image.');
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    try {
      data.images = await picker.resolveUrls();
      await eventService.createEvent(data);
      window.location.href = 'events.html';
    } catch (err) {
      showError(errorAlert, err.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Save & Publish Event &rarr;';
    }
  });
}

async function initAdminEditEventForm() {
  const form = document.getElementById('admin-edit-event-form');
  const errorAlert = document.getElementById('form-error-alert');

  const eventId = new URLSearchParams(window.location.search).get('id');
  if (!eventId) { window.location.href = 'events.html'; return; }

  const existing = await eventService.getEventById(eventId);
  if (!existing) { window.location.href = 'events.html'; return; }

  document.getElementById('event-id-hidden').value = existing.id;
  document.getElementById('event-title').value = existing.title;
  document.getElementById('event-description').value = existing.description;
  document.getElementById('event-full-content').value = existing.fullContent || existing.description;
  document.getElementById('event-date').value = existing.date;
  document.getElementById('event-time').value = existing.time;
  document.getElementById('event-location').value = existing.location;
  document.getElementById('event-category').value = existing.category;
  document.getElementById('event-status').value = existing.status;

  const picker = setupImagePicker({ initialUrls: existing.images || [], errorAlert });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readEventForm();
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!data.title || !data.description || !data.date || !data.time || !data.location) {
      return showError(errorAlert, 'Please fill out all required fields marked with *');
    }
    if (picker.count() === 0) {
      return showError(errorAlert, 'Please keep at least 1 event image.');
    }

    const originalLabel = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    try {
      data.images = await picker.resolveUrls();
      await eventService.updateEvent(eventId, data);
      window.location.href = 'events.html';
    } catch (err) {
      showError(errorAlert, err.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
}