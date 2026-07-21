// Admin dashboard for editing browser-stored KBS Onliners content.
const adminForm = document.querySelector("[data-admin-form]");
const note = document.querySelector("[data-admin-note]");
let draft = readSiteContent();
async function updateAuthStatus() {
  const status = document.querySelector("[data-auth-status]");
  const client = getSupabaseClient();
  if (!status || !client) {
    if (status) status.textContent = "Supabase is not connected yet.";
    return null;
  }

  const { data } = await client.auth.getSession();
  const user = data.session?.user || null;
  status.textContent = user ? `Signed in as ${user.email}. Online saves are enabled.` : "Not signed in. You can edit, but Supabase will reject online saves until you sign in.";
  return user;
}

function initAdminAuth() {
  const form = document.querySelector("[data-auth-form]");
  const signOut = document.querySelector("[data-auth-signout]");
  const client = getSupabaseClient();

  updateAuthStatus();
  if (!form || !client) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const { error } = await client.auth.signInWithPassword({
      email: data.get("email"),
      password: data.get("password")
    });

    if (error) {
      setNote(`Sign in failed: ${error.message}`);
    } else {
      form.reset();
      setNote("Signed in. You can now save online updates.");
    }
    updateAuthStatus();
  });

  signOut?.addEventListener("click", async () => {
    await client.auth.signOut();
    setNote("Signed out.");
    updateAuthStatus();
  });
}

function setNote(message) {
  if (note) note.textContent = message;
}

function fillAdminForm() {
  if (!adminForm) return;
  ["businessName", "tagline", "whatsappNumber", "heroEyebrow", "heroTitle", "heroText", "announcementTitle", "announcementText"].forEach((name) => {
    const field = adminForm.elements[name];
    if (field) field.value = draft[name] || "";
  });

  if (adminForm.elements.announcementEnabled) {
    adminForm.elements.announcementEnabled.checked = Boolean(draft.announcementEnabled);
  }

  renderTestimonialEditor();
  renderFaqEditor();
  updateJsonBox();
}

function collectSimpleFields() {
  const data = new FormData(adminForm);
  draft = {
    ...draft,
    businessName: data.get("businessName").trim(),
    tagline: data.get("tagline").trim(),
    whatsappNumber: normalizeWhatsAppNumber(data.get("whatsappNumber")),
    heroEyebrow: data.get("heroEyebrow").trim(),
    heroTitle: data.get("heroTitle").trim(),
    heroText: data.get("heroText").trim(),
    announcementEnabled: Boolean(data.get("announcementEnabled")),
    announcementTitle: data.get("announcementTitle").trim(),
    announcementText: data.get("announcementText").trim()
  };
}

function renderTestimonialEditor() {
  const editor = document.querySelector("[data-testimonial-editor]");
  if (!editor) return;

  editor.innerHTML = draft.testimonials.map((item, index) => `
    <article class="repeat-card" data-repeat-card="testimonial" data-index="${index}">
      <div class="admin-section-title">
        <h3>Review ${index + 1}</h3>
        <button class="text-danger" type="button" data-remove-testimonial="${index}">Remove</button>
      </div>
      <label>Category
        <select data-testimonial-field="category">
          <option value="ura" ${item.category === "ura" ? "selected" : ""}>URA</option>
          <option value="ursb" ${item.category === "ursb" ? "selected" : ""}>URSB</option>
          <option value="documents" ${item.category === "documents" ? "selected" : ""}>Documents</option>
        </select>
      </label>
      <label>Quote<textarea rows="3" data-testimonial-field="quote">${escapeHtml(item.quote)}</textarea></label>
      <div class="admin-grid">
        <label>Name<input type="text" data-testimonial-field="name" value="${escapeHtml(item.name)}"></label>
        <label>Label<input type="text" data-testimonial-field="label" value="${escapeHtml(item.label)}"></label>
      </div>
    </article>
  `).join("");
}

function renderFaqEditor() {
  const editor = document.querySelector("[data-faq-editor]");
  if (!editor) return;

  editor.innerHTML = draft.faqs.map((item, index) => `
    <article class="repeat-card" data-repeat-card="faq" data-index="${index}">
      <div class="admin-section-title">
        <h3>FAQ ${index + 1}</h3>
        <button class="text-danger" type="button" data-remove-faq="${index}">Remove</button>
      </div>
      <label>Question<input type="text" data-faq-field="question" value="${escapeHtml(item.question)}"></label>
      <label>Answer<textarea rows="3" data-faq-field="answer">${escapeHtml(item.answer)}</textarea></label>
    </article>
  `).join("");
}

function collectRepeats() {
  draft.testimonials = Array.from(document.querySelectorAll('[data-repeat-card="testimonial"]')).map((card) => ({
    category: card.querySelector('[data-testimonial-field="category"]').value,
    quote: card.querySelector('[data-testimonial-field="quote"]').value.trim(),
    name: card.querySelector('[data-testimonial-field="name"]').value.trim(),
    label: card.querySelector('[data-testimonial-field="label"]').value.trim()
  })).filter((item) => item.quote && item.name);

  draft.faqs = Array.from(document.querySelectorAll('[data-repeat-card="faq"]')).map((card) => ({
    question: card.querySelector('[data-faq-field="question"]').value.trim(),
    answer: card.querySelector('[data-faq-field="answer"]').value.trim()
  })).filter((item) => item.question && item.answer);
}

function updateJsonBox() {
  const box = adminForm.elements.contentJson;
  if (box) box.value = JSON.stringify(draft, null, 2);
}

function switchTab(name) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === name);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.adminPanel === name);
  });
}

if (adminForm) {
  fillAdminForm();
  initAdminAuth();

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.adminTab));
  });

  document.querySelector("[data-add-testimonial]")?.addEventListener("click", () => {
    collectSimpleFields();
    collectRepeats();
    draft.testimonials.push({ category: "ura", quote: "", name: "", label: "Service support" });
    renderTestimonialEditor();
    setNote("A new testimonial field was added.");
  });

  document.querySelector("[data-add-faq]")?.addEventListener("click", () => {
    collectSimpleFields();
    collectRepeats();
    draft.faqs.push({ question: "", answer: "" });
    renderFaqEditor();
    setNote("A new FAQ field was added.");
  });

  adminForm.addEventListener("click", (event) => {
    const testimonialIndex = event.target.dataset.removeTestimonial;
    const faqIndex = event.target.dataset.removeFaq;

    if (testimonialIndex !== undefined) {
      draft.testimonials.splice(Number(testimonialIndex), 1);
      renderTestimonialEditor();
      setNote("Testimonial removed. Save to publish the change.");
    }

    if (faqIndex !== undefined) {
      draft.faqs.splice(Number(faqIndex), 1);
      renderFaqEditor();
      setNote("FAQ removed. Save to publish the change.");
    }
  });

  document.querySelector("[data-export-content]")?.addEventListener("click", () => {
    collectSimpleFields();
    collectRepeats();
    updateJsonBox();
    setNote("Backup JSON refreshed.");
  });

  document.querySelector("[data-import-content]")?.addEventListener("click", () => {
    try {
      const restored = JSON.parse(adminForm.elements.contentJson.value);
      draft = { ...DEFAULT_CONTENT, ...restored };
      fillAdminForm();
  initAdminAuth();
      setNote("Backup restored in the editor. Save updates to publish it in this browser.");
    } catch (error) {
      setNote("The JSON could not be restored. Check for missing commas or quotes.");
    }
  });

  document.querySelector("[data-reset-content]")?.addEventListener("click", () => {
    draft = { ...DEFAULT_CONTENT };
    localStorage.removeItem(CONTENT_KEY);
    fillAdminForm();
  initAdminAuth();
    setNote("Defaults restored in this browser.");
  });

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    collectSimpleFields();
    collectRepeats();

    if (!draft.businessName || !draft.whatsappNumber || !draft.heroTitle) {
      setNote("Please keep the business name, WhatsApp number, and home headline filled in.");
      return;
    }

    const result = await writeSiteContent(draft);
    updateJsonBox();
    if (result.remote) {
      setNote("Updates saved to Supabase. Public pages can now load the new content online.");
    } else if (result.ok) {
      setNote("Updates saved in this browser. Supabase was not available yet.");
    } else {
      setNote("Saved locally, but Supabase rejected the update. Check the SQL policies and login status.");
    }
  });
}