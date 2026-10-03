/* ============================================================
   WYTU - SUPABASE CLIENT + SHARED SERVICES (js/supabase-client.js)
   Load AFTER the supabase-js CDN script, BEFORE admin.js / events.js
   ============================================================ */

// Supabase Dashboard > Project Settings > API
// Use the "anon / public" key ONLY. Never put the service_role key here.
const SUPABASE_URL = 'https://geeosbpolsifvrsutatn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_21uwy0S85jDgMUU09hUoRA_cSk7r0Cr';
const IMAGE_BUCKET = 'event-images';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

/* DB row (snake_case)  ->  object shape the existing UI code expects */
function fromRow(r) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.short_description,
    fullContent: r.full_details,
    date: r.event_date,
    time: r.event_time,
    location: r.location,
    category: r.category,
    images: r.images || [],
    status: r.status,
    createdAt: r.created_at
  };
}

/* UI object -> DB row. Only includes fields that were provided. */
function toRow(d) {
  const row = {};
  if (d.title !== undefined) { row.title = d.title; row.slug = slugify(d.title); }
  if (d.description !== undefined) row.short_description = d.description;
  if (d.fullContent !== undefined) row.full_details = d.fullContent;
  if (d.date !== undefined) row.event_date = d.date;
  if (d.time !== undefined) row.event_time = d.time;
  if (d.location !== undefined) row.location = d.location;
  if (d.category !== undefined) row.category = d.category;
  if (d.images !== undefined) row.images = d.images;
  if (d.status !== undefined) row.status = d.status;
  return row;
}

const eventService = {
  // Admin: everything, newest first. (RLS only returns drafts to a logged-in admin)
  async getAllEvents() {
    const { data, error } = await sb.from('events').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(fromRow);
  },

  // Public site: published only
  async getPublishedEvents() {
    const { data, error } = await sb.from('events').select('*')
      .eq('status', 'published').order('event_date', { ascending: true });
    if (error) throw error;
    return data.map(fromRow);
  },

  async getEventById(id) {
    const { data, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null; // also covers old non-UUID ids like "event-001"
    return fromRow(data);
  },

  async createEvent(eventData) {
    const { data, error } = await sb.from('events').insert(toRow(eventData)).select().single();
    if (error) throw error;
    return fromRow(data);
  },

  async updateEvent(id, updatedData) {
    const row = { ...toRow(updatedData), updated_at: new Date().toISOString() };
    const { data, error } = await sb.from('events').update(row).eq('id', id).select().single();
    if (error) throw error;
    return fromRow(data);
  },

  async deleteEvent(id) {
    const evt = await this.getEventById(id);
    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) throw error;
    // Best effort: also remove uploaded photos from storage
    if (evt && evt.images) {
      const marker = `/${IMAGE_BUCKET}/`;
      const paths = evt.images
        .filter(u => u.includes(marker))
        .map(u => decodeURIComponent(u.split(marker)[1]));
      if (paths.length) await sb.storage.from(IMAGE_BUCKET).remove(paths);
    }
    return true;
  },

  async togglePublishStatus(id) {
    const evt = await this.getEventById(id);
    if (!evt) return null;
    const newStatus = evt.status === 'published' ? 'draft' : 'published';
    await this.updateEvent(id, { status: newStatus });
    return newStatus;
  }
};

const storageService = {
  // Validates, uploads to Supabase Storage, returns the public URL
  async uploadImage(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new Error('Invalid file type. Only JPG, PNG, and WEBP images are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds the 5MB limit. Please select a smaller image.');
    }
    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(IMAGE_BUCKET).upload(path, file, {
      contentType: file.type, cacheControl: '31536000'
    });
    if (error) throw new Error('Image upload failed: ' + error.message);
    return sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }
};