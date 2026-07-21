// Shared interaction layer and Supabase-backed content controls for the KBS Onliners static site.
const CONTENT_KEY = "kbsOnlinersContent";
const SITE_CONTENT_ID = "main";
let kbsSupabaseClient = null;

const DEFAULT_CONTENT = {
  businessName: "KBS Onliners",
  tagline: "URA & URSB Service Desk",
  whatsappNumber: "256779682856",
  heroEyebrow: "Reliable online support in Uganda",
  heroTitle: "KBS Onliners makes URA and URSB processes easier to complete.",
  heroText: "Get guided help for tax registration, TIN support, business name searches, company registration steps, return filing preparation, document follow-up, and general online service inquiries.",
  announcementEnabled: true,
  announcementTitle: "Need urgent URA or URSB help?",
  announcementText: "Send your service request through WhatsApp and KBS Onliners will guide you on the next preparation step.",
  testimonials: [
    { category: "ura", quote: "KBS Onliners helped me understand what I needed before starting my TIN inquiry. The instructions were clear.", name: "Sarah N.", label: "URA support" },
    { category: "ursb", quote: "The business registration checklist saved time. I knew what details to prepare before asking for help.", name: "Brian K.", label: "URSB support" },
    { category: "documents", quote: "They reviewed my document requirements and explained the next steps without making the process complicated.", name: "Agnes T.", label: "Document readiness" },
    { category: "ura", quote: "Fast WhatsApp response and patient guidance. I appreciated the reminders about keeping passwords private.", name: "Daniel M.", label: "URA portal inquiry" }
  ],
  faqs: [
    { question: "Is KBS Onliners part of URA or URSB?", answer: "No. KBS Onliners is an independent support service that helps clients understand and prepare for official URA and URSB online processes." },
    { question: "Should I share my password?", answer: "No. Do not share official portal passwords, mobile money PINs, bank PINs, or one-time passwords. KBS Onliners can guide you without receiving private credentials." },
    { question: "How do I start?", answer: "Use the contact form or WhatsApp button. Describe the service, your current stage, and any non-sensitive reference information available." },
    { question: "Are government fees included?", answer: "Government fees, where applicable, are separate from service assistance fees. Confirm all official payment details before making payment." },
    { question: "Can I get same-day help?", answer: "Many inquiries can start the same day through WhatsApp. Completion times depend on the service type, client readiness, and official system availability." }
  ]
};

function mergeContent(content) {
  return {
    ...DEFAULT_CONTENT,
    ...(content || {}),
    testimonials: Array.isArray(content?.testimonials) ? content.testimonials : DEFAULT_CONTENT.testimonials,
    faqs: Array.isArray(content?.faqs) ? content.faqs : DEFAULT_CONTENT.faqs
  };
}

function getSupabaseClient() {
  if (kbsSupabaseClient) return kbsSupabaseClient;
  const config = window.KBS_SUPABASE_CONFIG;
  if (!window.supabase || !config?.url || !config?.key) return null;
  kbsSupabaseClient = window.supabase.createClient(config.url, config.key);
  return kbsSupabaseClient;
}

function readSiteContent() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTENT_KEY) || "{}");
    return mergeContent(saved);
  } catch (error) {
    console.warn("Could not read saved site content.", error);
    return mergeContent();
  }
}

async function readRemoteSiteContent() {
  const client = getSupabaseClient();
  if (!client) return readSiteContent();

  const { data, error } = await client
    .from("site_content")
    .select("content")
    .eq("id", SITE_CONTENT_ID)
    .maybeSingle();

  if (error) {
    console.warn("Supabase content read failed. Using local content instead.", error);
    return readSiteContent();
  }

  if (data?.content) {
    const content = mergeContent(data.content);
    localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
    return content;
  }

  return readSiteContent();
}

async function writeSiteContent(content) {
  const merged = mergeContent(content);
  localStorage.setItem(CONTENT_KEY, JSON.stringify(merged));

  const client = getSupabaseClient();
  if (!client) return { ok: true, remote: false };

  const { error } = await client
    .from("site_content")
    .upsert({ id: SITE_CONTENT_ID, content: merged, updated_at: new Date().toISOString() });

  if (error) {
    console.warn("Supabase content save failed. Local browser copy was still saved.", error);
    return { ok: false, remote: false, error };
  }

  return { ok: true, remote: true };
}

async function saveInquiry(inquiry) {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from("inquiries").insert({
    name: inquiry.name,
    phone: inquiry.phone,
    service: inquiry.service,
    message: inquiry.message,
    source: "website"
  });

  if (error) console.warn("Inquiry was not saved to Supabase.", error);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function normalizeWhatsAppNumber(value) {
  return String(value || DEFAULT_CONTENT.whatsappNumber).replace(/\D/g, "") || DEFAULT_CONTENT.whatsappNumber;
}

function whatsappUrl(number, text = "Hello KBS Onliners, I need help.") {
  return `https://wa.me/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(text)}`;
}

function applyManagedContent(content) {
  document.querySelectorAll(".brand strong, .site-footer strong").forEach((node) => {
    node.textContent = content.businessName;
  });
  document.querySelectorAll(".brand small").forEach((node) => {
    node.textContent = content.tagline;
  });

  const hero = document.querySelector(".hero-copy");
  if (hero) {
    const eyebrow = hero.querySelector(".eyebrow");
    const title = hero.querySelector("h1");
    const text = hero.querySelector(".hero-text");
    if (eyebrow) eyebrow.textContent = content.heroEyebrow;
    if (title) title.textContent = content.heroTitle;
    if (text) text.textContent = content.heroText;
  }

  document.querySelectorAll("a[href*='wa.me/']").forEach((link) => {
    const existingText = new URL(link.href).searchParams.get("text") || `Hello ${content.businessName}, I need help.`;
    link.href = whatsappUrl(content.whatsappNumber, existingText);
  });

  renderAnnouncement(content);
  renderManagedTestimonials(content);
  renderManagedFaqs(content);
}

function renderAnnouncement(content) {
  const oldAnnouncement = document.querySelector("[data-site-announcement]");
  if (oldAnnouncement) oldAnnouncement.remove();

  const main = document.querySelector("main");
  if (!main || !content.announcementEnabled) return;

  const firstSection = main.querySelector(".hero, .page-hero");
  if (!firstSection) return;

  const section = document.createElement("section");
  section.className = "section admin-announcement";
  section.dataset.siteAnnouncement = "true";
  section.innerHTML = `
    <div>
      <p class="eyebrow">Latest update</p>
      <h2>${escapeHtml(content.announcementTitle)}</h2>
      <p>${escapeHtml(content.announcementText)}</p>
    </div>
    <a class="button primary" href="${whatsappUrl(content.whatsappNumber, "Hello KBS Onliners, I saw your latest update and need help.")}" target="_blank" rel="noopener">Ask now</a>
  `;
  firstSection.insertAdjacentElement("afterend", section);
}

function renderManagedTestimonials(content) {
  const grid = document.querySelector("[data-testimonials]");
  if (!grid) return;

  grid.innerHTML = content.testimonials.map((item) => `
    <article data-category="${escapeHtml(item.category)}">
      <p>"${escapeHtml(item.quote)}"</p>
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.label)}</span>
    </article>
  `).join("");
}

function renderManagedFaqs(content) {
  const list = document.querySelector(".faq-list");
  if (!list) return;

  list.innerHTML = content.faqs.map((item) => `
    <article class="faq-item">
      <button type="button" aria-expanded="false">${escapeHtml(item.question)}</button>
      <div><p>${escapeHtml(item.answer)}</p></div>
    </article>
  `).join("");
}

function initNavigation() {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector("[data-nav-links]");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }
}

function initFaqs() {
  document.querySelectorAll(".faq-item button").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const isOpen = item.classList.toggle("open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
  });
}

function initTestimonialFilters() {
  const filterButtons = document.querySelectorAll("[data-filter]");
  const testimonials = document.querySelectorAll("[data-testimonials] article");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      testimonials.forEach((card) => {
        const shouldShow = selected === "all" || card.dataset.category === selected;
        card.hidden = !shouldShow;
      });
    });
  });
}

function initChecklist() {
  const checklistForm = document.querySelector("[data-checklist-form]");
  const checklistOutput = document.querySelector("[data-checklist-output]");

  const checklists = {
    ura: ["National ID or business details", "Service type: TIN, return, PRN, or portal inquiry", "Relevant period or reference number", "Phone number for follow-up"],
    ursb: ["Proposed business or company name", "Owner, director, or shareholder details", "Business activity and address", "Supporting documents where required"],
    documents: ["Document type and purpose", "Names and identification details", "Number of copies", "Any official instruction already received"]
  };

  if (checklistForm && checklistOutput) {
    checklistForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const type = new FormData(checklistForm).get("serviceType");
      const items = checklists[type] || [];
      checklistOutput.innerHTML = `<strong>Prepare these details:</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    });
  }
}

function setError(field, message) {
  const row = field.closest(".form-row");
  const messageNode = row ? row.querySelector(".error-message") : null;
  if (messageNode) messageNode.textContent = message;
  field.setAttribute("aria-invalid", message ? "true" : "false");
}

function initContactForm(content) {
  const contactForm = document.querySelector("[data-contact-form]");
  if (!contactForm) return;

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = Array.from(contactForm.querySelectorAll("input, select, textarea"));
    let isValid = true;

    fields.forEach((field) => {
      const value = field.value.trim();
      let message = "";

      if (field.required && !value) {
        message = "This field is required.";
      } else if (field.minLength > 0 && value.length < field.minLength) {
        message = `Please enter at least ${field.minLength} characters.`;
      } else if (field.type === "tel" && !/^\+?[0-9\s-]{9,18}$/.test(value)) {
        message = "Enter a valid phone number.";
      }

      setError(field, message);
      if (message) isValid = false;
    });

    const note = contactForm.querySelector("[data-form-note]");
    if (!isValid) {
      if (note) note.textContent = "Please fix the highlighted fields before sending.";
      return;
    }

    const data = new FormData(contactForm);
    const inquiry = {
      name: data.get("name"),
      phone: data.get("phone"),
      service: data.get("service"),
      message: data.get("message")
    };
    const message = [
      `Hello ${content.businessName}, I need assistance.`,
      `Name: ${inquiry.name}`,
      `Phone: ${inquiry.phone}`,
      `Service: ${inquiry.service}`,
      `Inquiry: ${inquiry.message}`
    ].join("\n");

    saveInquiry(inquiry);
    window.open(whatsappUrl(content.whatsappNumber, message), "_blank", "noopener");
    if (note) note.textContent = "WhatsApp has opened with your prepared message.";
  });
}

async function initSite() {
  const localContent = readSiteContent();
  applyManagedContent(localContent);
  initNavigation();
  initChecklist();
  initContactForm(localContent);
  initFaqs();
  initTestimonialFilters();

  const remoteContent = await readRemoteSiteContent();
  applyManagedContent(remoteContent);
  initFaqs();
  initTestimonialFilters();
}

initSite();