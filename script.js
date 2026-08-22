(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ======================================================================
     Progressive images — fade each photo in once decoded, drop the blur.
     ====================================================================== */
  $$(".photo").forEach(function (img) {
    function done() {
      img.classList.add("ready");
      var ph = img.closest(".ph");
      if (ph) ph.classList.add("ready");
    }
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });

  /* Hero copy animates in on the next frame so the transition actually runs. */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.body.classList.add("ready-in"); });
  });

  /* ======================================================================
     Visit log — one row per browser session, no cookies, no IP address.
     Silently does nothing if Supabase isn't configured yet or the table
     hasn't been created (see SETUP.md) — never blocks or errors the page.
     ====================================================================== */
  (function logVisit() {
    if (typeof VISITS_TABLE === "undefined" || !VISITS_TABLE) return;
    try {
      if (sessionStorage.getItem("visited")) return;
      sessionStorage.setItem("visited", "1");
    } catch (e) { /* private browsing / storage blocked — log anyway, just every load */ }

    function send() {
      if (!supabaseClient) return;
      supabaseClient.from(VISITS_TABLE).insert([{
        path: location.pathname + location.hash,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        language: navigator.language,
        viewport: window.innerWidth + "x" + window.innerHeight
      }]).then(function (res) {
        if (res.error) console.warn("[visits] not logged:", res.error.message);
      });
    }
    /* Never compete with the photos and fonts for the first paint. */
    if ("requestIdleCallback" in window) requestIdleCallback(send, { timeout: 4000 });
    else setTimeout(send, 1500);
  })();

  /* ======================================================================
     Header state, scroll progress, back-to-top, parallax  (one rAF loop)
     ====================================================================== */
  var hdr      = $("#hdr");
  var progress = $("#progress");
  var toTop    = $("#totop");
  var parallax = $$("[data-parallax]");
  var ticking  = false;

  function frame() {
    var y   = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    hdr.classList.toggle("solid", y > 60);
    progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    toTop.classList.toggle("show", y > window.innerHeight * 0.9);

    if (!reduce) {
      for (var i = 0; i < parallax.length; i++) {
        var el = parallax[i];
        var r  = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        var speed  = parseFloat(el.getAttribute("data-parallax")) || 0.15;
        var offset = (r.top + r.height / 2 - window.innerHeight / 2) * speed;
        el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
      }
    }
    ticking = false;
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  frame();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  /* ======================================================================
     Reveal on scroll — also triggers the SVG icon draw and the counters.
     ====================================================================== */
  var revealables = $$(".rv, .stagger, .svc, [data-count]");

  function activate(el) {
    el.classList.add("in");
    if (el.classList.contains("svc")) el.classList.add("drawn");
    if (el.hasAttribute("data-count")) countUp(el);
  }

  if (reduce || !("IntersectionObserver" in window)) {
    revealables.forEach(activate);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        activate(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* Give each SVG icon path its real length so the draw animation is even. */
  $$(".svc-ico").forEach(function (svg) {
    $$("path, circle, rect, ellipse", svg).forEach(function (p) {
      if (typeof p.getTotalLength !== "function") return;
      var len;
      try { len = p.getTotalLength(); } catch (err) { return; }
      if (len) p.style.setProperty("--len", Math.ceil(len));
    });
  });

  /* Animated counters in the communities cards. */
  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (isNaN(target) || reduce) return;

    var start = performance.now();
    var dur   = 1500;
    (function step(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US") + suffix;
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ======================================================================
     Scrollspy — highlight the nav link for the section you are looking at.
     ====================================================================== */
  var navLinks = $$(".nav a.n");
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  /* Light sections (cream/ivory backgrounds) need a light header to read
     against; everything else (hero, navy bands, contact) keeps the dark
     header. .cream is the only explicitly light modifier — a plain .band
     with no dark/deep class is also light (the default ivory body shows
     through), so it's the fallback case. */
  function sectionTone(el) {
    if (el.classList.contains("cream")) return "light";
    if (el.classList.contains("band") && !el.classList.contains("dark") && !el.classList.contains("deep")) return "light";
    return "dark";
  }

  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id);
        });
        hdr.dataset.tone = sectionTone(e.target);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ======================================================================
     About: Professional Journey / Software & Platforms / Skills & Trainings
     Work: project categories
     All rendered from data so the markup in index.html stays small — this
     is a lot of content, and hand-writing the repetition would be the real
     source of bugs.
     ====================================================================== */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var JOURNEY = [
    {
      company: "Herrick Filters", location: "Philippines", role: "Admin / Quality Control",
      summary: "My first corporate role, balancing office administration with quality control. It taught me that discipline and attention to detail are the foundation everything else gets built on.",
      responsibilities: ["Managed administrative and office support functions", "Performed quality control inspections and monitoring", "Maintained documentation, filing systems and records management", "Ensured compliance with company quality standards and procedures", "Prepared reports and coordinated internal operations", "Assisted in inventory monitoring and operational coordination"],
      skills: [
        { group: "Administrative", items: ["Administrative Support", "Office Operations", "Documentation & Filing", "Data Entry & Records", "Inventory Monitoring", "Scheduling & Coordination"] },
        { group: "Quality Control", items: ["Quality Inspection", "Compliance Checking", "Defect Identification", "SOP Implementation", "Accuracy Verification"] },
        { group: "Professional", items: ["Communication", "Team Collaboration", "Accountability", "Critical Thinking", "Workplace Discipline"] }
      ]
    },
    {
      company: "City of Dreams Manila", location: "Philippines", role: "Casino Signature to VVIP Dealer / Poker Stars Dealer", period: "2 years",
      summary: "Entering the luxury casino world as an outsider, surrounded by UHNWIs, I learned that belonging isn't about background — it's the discipline to learn the table games and the composure VIP service demands.",
      responsibilities: ["Operated Baccarat, Baccarat Super Six, Roulette, Blackjack, Pontoon, Poker, Three Card Poker, Luna Poker, Sic Bo and Money Wheel", "Delivered exceptional service to VIP and VVIP clients while maintaining discretion", "Maintained precision, composure and attention to detail on every transaction"],
      skills: [
        { group: "Casino Operations & Professional", items: ["VIP & VVIP Client Management", "Gaming Operations", "High-Stakes Cash/Chip Transactions", "Fraud Prevention Awareness", "Luxury Guest Relations", "Fast Mental Mathematics", "Decision-Making Under Pressure", "Situational Awareness"] }
      ]
    },
    {
      company: "Okada Manila", location: "Philippines", role: "Casino Signature to VVIP Dealer Supervisor", period: "1 year",
      summary: "Stepping into supervision meant leading people, not just performing — overseeing dealer operations, coaching staff and staying calm when everyone else was under pressure.",
      responsibilities: ["Oversaw dealer operations and monitored staff performance", "Coordinated activities and maintained operational standards", "Handled situations requiring immediate judgment and escalation"],
      skills: [
        { group: "Leadership & Operations", items: ["Dealer & Team Supervision", "Staff Training & Coaching", "Shift Coordination", "Surveillance Coordination", "Conflict Resolution", "Client Retention"] }
      ]
    },
    {
      company: "SMDC", location: "Philippines", role: "Licensed Realtor | International Property Specialist",
      summary: "Closing PHP 150 million in property within 45 days and supervising 30+ brokers taught me that real estate is about trust and resilience, not just sales.",
      responsibilities: ["Handled horizontal and vertical property projects across Canada, Dubai, Hong Kong, Macau, Thailand, Cambodia and Vietnam", "Managed and supervised 30+ brokers, ranked Top 3 Salesperson within the unit", "Closed PHP 150 million in property deals within 45 days", "Prepared project presentations, investment proposals and market research", "Developed marketing budgets, generated leads and processed client documentation"],
      skills: [
        { group: "Leadership & Team", items: ["Broker Management", "Team Leadership", "Sales Supervision", "Mentorship & Coaching"] },
        { group: "Marketing & Sales", items: ["Lead Generation", "Campaign Coordination", "High-Ticket Sales Closing", "Revenue Execution"] },
        { group: "Client & Strategy", items: ["Client Consultation", "Relationship Building", "Negotiation", "Market & Investment Research", "Strategic Planning"] }
      ]
    },
    {
      company: "Property Management, Holiday Homes & Investment Company", location: "Dubai", role: "Sales Executive to Admin to Operations Manager",
      summary: "My first company and first job in Dubai — from acquiring property through cold calling and negotiation to running tenant relations and day-to-day operations. When you manage people's homes and money, responsibility goes far beyond the transaction.",
      responsibilities: ["Conducted cold calling, lead generation and owner negotiations for property acquisition", "Managed contract preparation, payments and government compliance", "Posted property advertisements and negotiated leasing agreements", "Secured tenants and assisted with move-in / move-out procedures", "Coordinated rental payments, billing, maintenance and property upkeep"],
      skills: [
        { group: "Business Development", items: ["Cold Calling & Lead Generation", "Client Acquisition", "Negotiation", "Property Acquisition"] },
        { group: "Admin & Legal", items: ["Contract Processing", "Government Coordination", "Permit Resolution", "Compliance Coordination"] },
        { group: "Leasing & Operations", items: ["Tenant Acquisition & Screening", "Move-In / Move-Out Coordination", "Rent Collection", "Vendor Coordination"] },
        { group: "Customer Service", items: ["Tenant Relations", "Complaint Handling", "Relationship Management"] }
      ]
    },
    {
      company: "SHE BUILDS BRANDS", location: "", role: "Marketing & EA Manager",
      summary: "Encouraged to self-study branding, I discovered marketing was more than a skill I could perform — it became something I genuinely enjoyed creating, alongside my first taste of podcasting and content creation.",
      responsibilities: [],
      skills: [
        { group: "Marketing & Branding", items: ["Brand Development", "Brand Positioning", "Campaign Management", "Social Media Marketing", "Content Planning"] },
        { group: "Leadership", items: ["Team Coordination", "Project Management", "Creative Direction", "Client Management"] },
        { group: "Communication", items: ["Presentation Skills", "Copywriting", "Public Relations", "Networking", "Podcasting"] },
        { group: "Business", items: ["Market Research", "Competitor Analysis", "Business Development"] }
      ]
    },
    {
      company: "AVANTGARDE", location: "", role: "Marketing Coordinator | Event Coordinator | Market Research",
      summary: "The chapter I most enjoyed — campaign coordination and event execution across cultures, with room to bring my own ideas, creativity and perspective to every project.",
      responsibilities: ["Coordinated marketing campaigns and promotional activities", "Planned and managed event operations and logistics", "Conducted market research and consumer analysis", "Managed vendor and client coordination", "Prepared reports and market insights for strategic initiatives"],
      skills: [
        { group: "Marketing", items: ["Campaign Execution", "Brand Promotion", "Consumer Insights", "Advertising Coordination"] },
        { group: "Event Management", items: ["Event Planning & Operations", "Vendor & Client Coordination", "Logistics Management", "Event Execution"] },
        { group: "Research & Admin", items: ["Market & Competitor Research", "Trend Analysis", "Strategic Reporting", "Budget & Timeline Management"] }
      ]
    },
    {
      company: "ML Property Management & Cleaning Company", location: "", role: "Operations Director", period: "2022 – May 2026",
      summary: "The most demanding and defining chapter of my professional and personal life — overseeing Sales, Marketing, Admin, Accounts, Operations and HR while carrying some of the deepest grief of my life. It taught me that leadership sometimes just looks like showing up.",
      responsibilities: ["Directed overall business operations and business development", "Led sales, marketing, client acquisition and retention strategies", "Managed administration, HR, recruitment, scheduling and team performance", "Oversaw budgeting, expenses, payroll coordination and financial reporting", "Supervised field operations, logistics, service delivery and quality assurance", "Developed operational systems and implemented process improvements"],
      skills: [
        { group: "Core Skills", items: ["Executive & Operations Management", "Strategic Planning", "Team Leadership", "Recruitment & HR", "Budgeting & Financial Management", "Client Relationship Management", "Quality Assurance", "Negotiation & Conflict Resolution", "Process Improvement"] }
      ]
    }
  ];

  var SOFTWARE = [
    { group: "Google Workspace", items: ["Sheets", "Docs", "Slides", "Mail", "Forms", "Drive", "Google Business", "Google Analytics", "NotebookLM"] },
    { group: "Zoho", items: ["CRM", "Invoices", "Expenses", "Quotations", "Project Management", "Bookings", "Bigin", "Calendar"] },
    { group: "Microsoft", items: ["Word", "Excel", "Outlook", "PowerPoint", "Teams", "Copilot"] },
    { group: "Adobe", items: ["Lightroom", "Firefly", "Express", "Acrobat Pro", "Scan"] },
    { group: "AI Tools", items: ["Claude — with certificates", "ChatGPT", "Notion — with certificates"] },
    { group: "Design & Content", items: ["Canva", "Affinity", "Snapseed", "Wix", "Base44"] },
    { group: "Marketing & CRM", items: ["HubSpot", "Mailchimp", "Campayn", "LinkedIn", "ConnectTeam"] },
    { group: "Meta", items: ["Facebook", "Instagram", "WhatsApp", "WhatsApp Business"] },
    { group: "Other", items: ["cPanel", "Monday.com", "YouTube"] }
  ];

  var TRAININGS_FLAT = ["TESDA Caregiver — NCII License Holder", "Basic Accounting", "Corporate Tax Foundation Program (ongoing)", "Brand Strategy 101", "Brand Strategy Planning", "Business Model Canvas", "Event Marketing Creative Brief", "Social Media Strategy", "Building Your Brand", "Buying Cycles", "Competitor Analysis", "Email Marketing 101", "Marketing Planning Pyramid", "Style Statement", "VIA — Values, Interests & Abilities", "Dog or Wolf", "Get in the Room", "Keep Walking", "Limiting Self-Belief", "Mindset Shift", "Vision for the Decade", "Money Habits"];

  var LEARNING_PATHS = [
    { name: "Notion", steps: ["Essentials Path — basic skills to create, collaborate and organize workflows", "Workflows Path — connected systems that unite teams and projects with AI", "Notion AI Path — using AI agents and scaling confidently across organizations", "Advance Path — automating work, workspace architecture, complex capabilities", "Certified Admin Path — managing and securing Notion for any organization"] },
    { name: "Claude", steps: ["Claude 101", "Claude Code 101", "Introduction to Claude Cowork", "Claude Code in Action", "AI Fluency: Framework and Foundations", "Building with the Claude API", "Introduction to Model Context Protocol", "Teaching AI Fluency", "AI Fluency for Nonprofits", "AI Capabilities and Limitations", "AI Fluency for Small Businesses"] }
  ];

  var PROJECTS = [
    { id: "destination", label: "Destination & Government", items: [
      { name: "LIWA Festival 2022", type: "Festival · Integrated Marketing, Influencer Management & Partnerships",
        points: ["Developed and supported the integrated marketing strategy for LIWA Festival 2022", "Managed influencer strategy, coordination and relationships", "Coordinated partnerships and promotional opportunities surrounding the festival"],
        note: "Delivered for DCT Abu Dhabi with AVANTGARDE Middle East — 178 influencers, 25.3M social reach, 78,511 visitors." },
      { name: "Abu Dhabi Events", type: "Destination Platform · Year-Round Marketing Campaigns",
        points: ["Supported year-round campaigns and promotional activities for Abu Dhabi's events ecosystem", "Contributed to campaign strategy, communications and audience engagement"] },
      { name: "Abu Dhabi Culinary", type: "Destination Platform · Marketing & Events",
        points: ["Supported year-round marketing campaigns for Abu Dhabi's culinary and dining ecosystem", "Contributed to hospitality engagement, event promotion and audience development"] },
      { name: "Abu Dhabi Retail", type: "Destination Retail Platform · Integrated Marketing & Activations",
        points: ["Supported year-round retail marketing campaigns across Abu Dhabi", "Contributed to influencer marketing, social media, OOH and mall communications"],
        note: "The Winter Shopping Season campaign spanned 23 malls with substantial visitor traffic and social reach." }
    ]},
    { id: "luxury", label: "Luxury & Retail", items: [
      { name: "Charlotte Tilbury × Society UAE", type: "Brand Activation · Layali Ramadan",
        points: ["Supported the luxury Majlis activation and execution", "Contributed to the partnership between Charlotte Tilbury, Society and the retail campaign", "Supported influencer engagement and campaign communications"] },
      { name: "FENDI × Tashas", type: "Brand Activation · Layali Ramadan",
        points: ["Supported the UAE's first FENDI Majlis experience", "Contributed to luxury brand activation and influencer engagement"] },
      { name: "Diptyque × Ethr", type: "Fragrance Activation · Product Launch",
        points: ["Supported the 14-day takeover at Mamsha Saadiyat", "Contributed to the introduction of the Eau Nabati fragrance collection", "Supported product discovery workshops and consumer engagement"] },
      { name: "Bath & Body Works", type: "Product Launch · Dark Velvet Oud",
        points: ["Supported the launch of the Dark Velvet Oud fragrance collection", "Contributed to product launch strategy and brand experience"] },
      { name: "Layali Ramadan", type: "Ramadan Campaign · Integrated Marketing",
        points: ["Supported luxury retail, beauty, fashion, culinary and lifestyle activations", "Coordinated brand partnerships across influencer, retail and event touchpoints"] },
      { name: "KVD Sunset Party", type: "Brand Activation · Influencer & Experiential",
        points: ["Supported event and influencer coordination", "Contributed to an engaging beauty and lifestyle experience"] }
    ]},
    { id: "automotive", label: "Automotive & Design", items: [
      { name: "Al-Futtaim — Intersect by Lexus", type: "Marketing & Events Management",
        points: ["Supported marketing and events management for Intersect by Lexus", "Contributed to luxury lifestyle experiences across automotive, design and dining"] },
      { name: "An Evening With…", type: "Luxury Experience · Event Management",
        points: ["Supported the planning and execution of the guest experience", "Coordinated event requirements, stakeholders and influencer management"] }
    ]},
    { id: "gaggenau", label: "GAGGENAU", items: [
      { name: "GAGGENAU", type: "Global Luxury Kitchen Appliances · Marketing & Events Management",
        points: ["Supported luxury brand positioning through culinary, design and experiential events", "Worked across luxury hospitality, culinary talent, designers and high-value audiences"] },
      { name: "The Blank Canvas", type: "Luxury Experiential Event",
        points: ["Supported an immersive intersection of culinary arts, design and visual art", "Supported event coordination, guest experience and talent management"] },
      { name: "Limitless Imagination", type: "Luxury Experiential Event",
        points: ["Supported an immersive experience combining architecture, design, culinary arts and digital creativity", "Supported event execution and stakeholder coordination"] },
      { name: "Connoisseur Awards", type: "Luxury Culinary Awards",
        points: ["Supported marketing and event management surrounding the Connoisseur Awards", "Contributed to a high-profile culinary awards experience"] }
    ]},
    { id: "telecom", label: "Telecom & Retail Launches", items: [
      { name: "du — Dubai Hills Mall", type: "Concept Store Launch",
        points: ["Supported the launch of du's new concept store at Dubai Hills Mall", "Contributed to launch planning, event execution and customer experience", "Contributed to a technology-driven retail experience with digital signage and self-service touchpoints"] }
    ]},
    { id: "sport", label: "Sport & Athletes", items: [
      { name: "Formula Woman", type: "Motorsport Community · Marketing Strategy, Sponsorship & Events",
        points: ["Developed and supported marketing strategy for the Formula Woman motorsport community", "Supported sponsorship and partnership development", "Worked on positioning motorsport as an accessible, empowering community for women"] },
      { name: "Tariq Lamptey × adidas", type: "Brand & Marketing Strategy",
        points: ["Supported brand and marketing strategy for international footballer Tariq Lamptey", "“Dream. Pray. Overcome. Win.” — partnership management, content, PR and grassroots football", "Worked across sports marketing, brand partnerships and audience engagement"] }
    ]},
    { id: "podcast", label: "ONE by AVA Podcast", items: [
      { name: "Michael Cinco", type: "Interview · Fashion, Luxury & Creative Industry",
        points: ["Interviewed internationally renowned Filipino fashion designer Michael Cinco", "Explored his creative journey and evolution as a global luxury designer"], link: "https://www.youtube.com/watch?v=jkEeFAq2Ed8" },
      { name: "Marc Schumacher", type: "Interview · The Power of Brand Communities",
        points: ["Explored community building, consumer engagement and brand loyalty", "Discussed how brands build stronger relationships around shared values"], link: "https://www.youtube.com/watch?v=0yh5EihmNiY" },
      { name: "Philip Bucknell", type: "Interview · The Future of Brand Experiences",
        points: ["Explored experiential marketing, innovation and changing audience expectations", "Discussed the evolution from traditional marketing toward immersive brand experiences"], link: "https://www.youtube.com/watch?v=BcO-Z3EJWb0" }
    ]},
    { id: "fashion", label: "Fashion & Pageants", items: [
      { name: "Philippines Top Model", type: "International Pageant · Sponsorship & Partnership Director",
        points: ["Directed sponsorship and partnership development", "Managed relationships with brands, sponsors and strategic partners", "Supported model management and talent coordination"] },
      { name: "International Top Model", type: "International Pageant · Sponsorship & Partnership Director",
        points: ["Led sponsorship and partnership initiatives", "Managed brand and commercial relationships", "Supported model and talent management"] },
      { name: "Ageless Collection", type: "Fashion Show · Creative Stylist",
        points: ["Supported creative direction and styling of the fashion show", "Developed and coordinated fashion presentation concepts"] },
      { name: "Khatoon International", type: "Marketing Director",
        points: ["Led marketing strategy and communications", "Developed brand positioning and promotional initiatives"] },
      { name: "Malaysia Truly Asia", type: "Annual UAE Event · Stage Director",
        points: ["Directed stage operations for the annual event in the UAE", "Coordinated stage programming, performers, speakers and production requirements"] },
      { name: "Graphite Studio", type: "Client Acquisition",
        points: ["Supported client acquisition for one of the largest festivals in the UAE"] }
    ]}
  ];

  /* -- accordion: shared open/close, one item open at a time per list -- */
  function wireAccordion(container) {
    $$(".acc-head", container).forEach(function (head) {
      head.addEventListener("click", function () {
        var item = head.closest(".acc-item");
        var willOpen = !item.classList.contains("open");
        $$(".acc-item.open", container).forEach(function (o) {
          if (o !== item) { o.classList.remove("open"); $(".acc-head", o).setAttribute("aria-expanded", "false"); }
        });
        item.classList.toggle("open", willOpen);
        head.setAttribute("aria-expanded", String(willOpen));
      });
    });
  }

  function journeyItemHtml(j, i, idx) {
    var cols = j.skills.map(function (g) {
      return '<div><h5>' + esc(g.group) + '</h5><ul>' +
        g.items.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
        "</ul></div>";
    }).join("");
    var points = j.responsibilities.length
      ? '<ul class="acc-points">' + j.responsibilities.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>"
      : "";
    var bodyId = "jr-body-" + i;
    return (
      '<div class="acc-item' + (i === 0 ? " open" : "") + '">' +
        '<button class="acc-head" type="button" aria-expanded="' + (i === 0 ? "true" : "false") + '" aria-controls="' + bodyId + '">' +
          '<span class="acc-titles"><span class="acc-name">' + esc(j.company) + (j.location ? ", " + esc(j.location) : "") + '</span>' +
          '<span class="acc-role">' + esc(j.role) + '</span></span>' +
          '<span class="acc-meta">' + (j.period ? "<span>" + esc(j.period) + "</span>" : "") + '<span class="acc-plus" aria-hidden="true"></span></span>' +
        '</button>' +
        '<div class="acc-body" id="' + bodyId + '"><div class="acc-body-in">' +
          '<p class="acc-summary">' + esc(j.summary) + '</p>' +
          points +
          '<div class="acc-cols">' + cols + '</div>' +
        '</div></div>' +
      '</div>'
    );
  }

  function renderJourney() {
    var host = $("#ax-journey");
    if (!host) return;
    host.innerHTML = '<div class="acc">' + JOURNEY.map(journeyItemHtml).join("") + '</div>';
    wireAccordion(host);
  }

  function renderSoftware() {
    var host = $("#ax-software");
    if (!host) return;
    host.innerHTML = '<div class="chip-groups">' + SOFTWARE.map(function (g) {
      return '<div><h5>' + esc(g.group) + '</h5><div class="chips">' +
        g.items.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join("") +
        '</div></div>';
    }).join("") + '</div>';
  }

  function renderSkills() {
    var host = $("#ax-skills");
    if (!host) return;
    var flat = '<div class="sk-flat"><div class="chips">' +
      TRAININGS_FLAT.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join("") +
      '</div></div>';
    var paths = '<div class="sk-paths">' + LEARNING_PATHS.map(function (p) {
      return '<div class="sk-path"><h5>' + esc(p.name) + '</h5><ol>' +
        p.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
        '</ol></div>';
    }).join("") + '</div>';
    host.innerHTML = flat + paths;
  }

  function projectItemHtml(p, i, catId) {
    var points = '<ul class="acc-points">' + p.points.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
    var note = p.note ? '<p class="acc-note">' + esc(p.note) + "</p>" : "";
    var link = p.link ? '<a class="acc-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">Watch the interview <span>↗</span></a>' : "";
    var bodyId = "pj-body-" + catId + "-" + i;
    return (
      '<div class="acc-item">' +
        '<button class="acc-head" type="button" aria-expanded="false" aria-controls="' + bodyId + '">' +
          '<span class="acc-titles"><span class="acc-name">' + esc(p.name) + '</span>' +
          '<span class="acc-role">' + esc(p.type) + '</span></span>' +
          '<span class="acc-meta"><span class="acc-plus" aria-hidden="true"></span></span>' +
        '</button>' +
        '<div class="acc-body" id="' + bodyId + '"><div class="acc-body-in">' +
          points + note + link +
        '</div></div>' +
      '</div>'
    );
  }

  function renderProjects() {
    var tabHost = $("#proj-tabs");
    var listHost = $("#proj-list");
    if (!tabHost || !listHost) return;

    tabHost.innerHTML = PROJECTS.map(function (cat, i) {
      return '<button class="proj-tab" type="button" data-cat="' + cat.id + '" role="tab" aria-selected="' + (i === 0 ? "true" : "false") + '">' + esc(cat.label) + '</button>';
    }).join("");

    listHost.innerHTML = PROJECTS.map(function (cat, i) {
      var acc = '<div class="acc">' + cat.items.map(function (p, j) { return projectItemHtml(p, j, cat.id); }).join("") + '</div>';
      return '<div class="proj-cat' + (i === 0 ? " on" : "") + '" data-cat-panel="' + cat.id + '">' + acc + '</div>';
    }).join("");

    $$(".proj-cat", listHost).forEach(function (panel) { wireAccordion(panel); });

    tabHost.addEventListener("click", function (e) {
      var btn = e.target.closest(".proj-tab");
      if (!btn) return;
      activateProjectCategory(btn.getAttribute("data-cat"));
    });
  }

  function activateProjectCategory(catId) {
    $$(".proj-tab", document).forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-cat") === catId)); });
    $$(".proj-cat", document).forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-cat-panel") === catId); });
  }

  function activateAboutTab(key) {
    $$(".ax-tab", document).forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-ax") === key)); });
    $$(".ax-panel", document).forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-ax-panel") === key); });
  }

  renderJourney();
  renderSoftware();
  renderSkills();
  renderProjects();

  var axTabs = $("#ax-tabs");
  if (axTabs) {
    axTabs.addEventListener("click", function (e) {
      var btn = e.target.closest(".ax-tab");
      if (!btn) return;
      activateAboutTab(btn.getAttribute("data-ax"));
    });
  }

  /* Header dropdowns: picking an item switches the tab/category on the page.
     The generic anchor handler (further down) still performs the scroll,
     since these links share the same #about / #work hrefs as the main nav.
     The Contact "Selected work" dropdown (.click-drop) is excluded here —
     it has its own selection behaviour below, not a navigate-and-switch one. */
  $$('.drop a[data-ax]').forEach(function (a) {
    a.addEventListener("click", function () { activateAboutTab(a.getAttribute("data-ax")); });
  });
  $$('.drop a[data-proj]').forEach(function (a) {
    if (a.closest(".click-drop")) return;
    a.addEventListener("click", function () { activateProjectCategory(a.getAttribute("data-proj")); });
  });

  /* A click doesn't move the cursor, so CSS :hover has no way to know the
     panel should close — left alone it stays pinned open and drifts over
     whatever just scrolled up underneath the header. Force it shut right
     after a pick, and let normal hover behaviour resume once the mouse
     actually leaves. */
  $$('.has-drop:not(.click-drop)').forEach(function (group) {
    $$('.drop a', group).forEach(function (a) {
      a.addEventListener("click", function () { group.classList.add("suppress"); });
    });
    group.addEventListener("mouseleave", function () { group.classList.remove("suppress"); });
  });

  /* Click-to-open dropdown (Contact's "Selected work"): the trigger itself
     no longer navigates — it opens the menu. Works at every viewport width,
     including touch, unlike the header's hover-only previews. */
  $$(".click-drop").forEach(function (wrap) {
    var trigger = $("a", wrap);
    var panel = $(".drop", wrap);

    /* The panel's width changes with its own text-wrapping (column layout
       re-flows per item length) and the trigger's position varies by
       viewport, so a static CSS left/right rule can't cover every case.
       Measure the actual overflow after layout and nudge it back on-screen. */
    function clampHorizontal() {
      panel.style.left = "";
      panel.style.right = "";
      var margin = 12;
      var r = panel.getBoundingClientRect();
      var overflowRight = r.right - (window.innerWidth - margin);
      var overflowLeft = margin - r.left;
      if (overflowRight <= 0 && overflowLeft <= 0) return;

      var parentR = panel.offsetParent.getBoundingClientRect();
      var target = overflowRight > 0
        ? Math.max(r.left - overflowRight, margin)
        : r.left + overflowLeft;
      panel.style.left = (target - parentR.left) + "px";
      panel.style.right = "auto";
    }

    function setOpen(open) {
      wrap.classList.toggle("open", open);
      trigger.setAttribute("aria-expanded", String(open));
      if (open) clampHorizontal();
    }
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      /* The generic a[href^="#"] handler further down would otherwise also
         fire on this element and smooth-scroll away — this trigger only
         toggles the menu, it never navigates on its own. */
      e.stopImmediatePropagation();
      setOpen(!wrap.classList.contains("open"));
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && wrap.classList.contains("open")) { setOpen(false); trigger.focus(); }
    });
    /* Picking a category here doesn't take you to Services — it tags what
       kind of work the enquiry is about, so it travels with the message
       when the contact form is submitted (see the "Category" line the
       submit handler prepends). Click the same item again to clear it. */
    var defaultLabel = trigger.textContent;
    wrap.dataset.defaultLabel = defaultLabel;
    wrap.dataset.selected = "";
    $$("a[data-proj]", wrap).forEach(function (item) {
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", "false");
      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        var id = item.getAttribute("data-proj");
        var picking = wrap.dataset.selected !== id;

        $$("a[data-proj]", wrap).forEach(function (i) { i.setAttribute("aria-checked", "false"); });

        if (picking) {
          item.setAttribute("aria-checked", "true");
          wrap.dataset.selected = id;
          wrap.dataset.selectedLabel = item.textContent.trim();
          trigger.textContent = "Work: " + item.textContent.trim();
        } else {
          wrap.dataset.selected = "";
          wrap.dataset.selectedLabel = "";
          trigger.textContent = defaultLabel;
        }
        setOpen(false);
      });
    });
  });

  function resetWorkPick() {
    var wg = $(".click-drop");
    if (!wg) return;
    var trig = $("a", wg);
    wg.dataset.selected = "";
    wg.dataset.selectedLabel = "";
    trig.textContent = wg.dataset.defaultLabel || "Selected work";
    $$("a[data-proj]", wg).forEach(function (i) { i.setAttribute("aria-checked", "false"); });
  }

  /* ======================================================================
     Mobile drawer
     ====================================================================== */
  var burger = $("#burger");
  var drawer = $("#drawer");

  function setDrawer(open) {
    drawer.classList.toggle("open", open);
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("locked", open);
  }

  burger.addEventListener("click", function () {
    setDrawer(!drawer.classList.contains("open"));
  });
  $$("a", drawer).forEach(function (a) {
    a.addEventListener("click", function () { setDrawer(false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("open")) {
      setDrawer(false);
      burger.focus();
    }
  });

  /* Smooth anchor scrolling that accounts for the fixed header. */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY -
                (target.id === "top" ? 0 : 70);
      window.scrollTo({ top: Math.max(top, 0), behavior: reduce ? "auto" : "smooth" });
      history.replaceState(null, "", id);
    });
  });

  /* ======================================================================
     Client marquee — duplicate the row so the loop is seamless.
     ====================================================================== */
  var marq = $("#marq");
  if (marq && marq.firstElementChild) {
    marq.appendChild(marq.firstElementChild.cloneNode(true));
  }

  /* ======================================================================
     Conversations carousel — dots, arrows, keyboard, swipe, autoplay.
     ====================================================================== */
  var car    = $("#car");
  var slides = $$(".slide", car);
  var dots   = $("#dots");
  var idx = 0, timer = null;

  slides.forEach(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", "Conversation " + (i + 1));
    b.setAttribute("aria-selected", i === 0 ? "true" : "false");
    b.addEventListener("click", function () { show(i); restart(); });
    dots.appendChild(b);
  });

  function show(n) {
    idx = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) {
      s.classList.toggle("on", i === idx);
      s.setAttribute("aria-hidden", i === idx ? "false" : "true");
    });
    Array.prototype.forEach.call(dots.children, function (b, i) {
      b.setAttribute("aria-selected", i === idx ? "true" : "false");
      /* restart the fill animation on the active dot */
      if (i === idx) { b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; }
    });
  }

  function start()   { if (!reduce && !timer) timer = setInterval(function () { show(idx + 1); }, 8000); }
  function stop()    { clearInterval(timer); timer = null; }
  function restart() { stop(); start(); }

  $("#next").addEventListener("click", function () { show(idx + 1); restart(); });
  $("#prev").addEventListener("click", function () { show(idx - 1); restart(); });

  car.addEventListener("mouseenter", stop);
  car.addEventListener("mouseleave", start);
  car.addEventListener("focusin", stop);

  car.setAttribute("tabindex", "0");
  car.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { show(idx + 1); restart(); }
    if (e.key === "ArrowLeft")  { show(idx - 1); restart(); }
  });

  var touchX = null;
  car.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; stop(); }, { passive: true });
  car.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) show(idx + (dx < 0 ? 1 : -1));
    touchX = null;
    start();
  }, { passive: true });

  start();

  /* ======================================================================
     Contact form — floating labels, live validation, Supabase + email.
     ====================================================================== */
  var form    = $("#cform");
  var note    = $("#fnote");
  var sendBtn = $("#send");
  var counter = $("#count");

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var mailto   = "mailto:" + (typeof NOTIFY_EMAIL !== "undefined" ? NOTIFY_EMAIL : "");

  /* Floating-label state. */
  $$("[data-field]").forEach(function (field) {
    var input = $("input, textarea", field);
    var sync  = function () { field.classList.toggle("filled", input.value.trim() !== ""); };
    input.addEventListener("focus", function () { field.classList.add("focus"); });
    input.addEventListener("blur", function () {
      field.classList.remove("focus");
      sync();
      validate(input, true);
    });
    input.addEventListener("input", function () {
      sync();
      if (field.classList.contains("invalid")) validate(input, true);
    });
    sync();
  });

  $("#f-msg").addEventListener("input", function () {
    counter.textContent = this.value.length + " / 2000";
  });

  function validate(input, showError) {
    var field = input.closest(".field");
    var err   = $(".field-err", field);
    var val   = input.value.trim();
    var msg   = "";

    if (!val) {
      msg = "This one is required.";
    } else if (input.type === "email" && !EMAIL_RE.test(val)) {
      msg = "That email address does not look right.";
    } else if (input.id === "f-msg" && val.length < 10) {
      msg = "A little more detail, please — at least 10 characters.";
    }

    field.classList.toggle("invalid", !!msg && showError);
    if (err) err.textContent = showError ? msg : "";
    return !msg;
  }

  function setNote(text, kind) {
    note.innerHTML = text;
    note.className = "form-note" + (kind ? " " + kind : "");
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    /* Honeypot: a filled "company" field means a bot. Pretend it worked. */
    if ($("#f-company").value) { setNote("Message sent.", "success"); form.reset(); return; }

    var inputs = [$("#f-name"), $("#f-email"), $("#f-msg")];
    var ok = inputs.map(function (i) { return validate(i, true); }).every(Boolean);
    if (!ok) {
      setNote("Please fix the highlighted fields.", "error");
      var firstBad = $(".field.invalid input, .field.invalid textarea");
      if (firstBad) firstBad.focus();
      return;
    }

    /* If a category was picked in "Selected work", fold it into the message
       as a labelled first line rather than adding a new database column —
       it reads clearly in the table and the email either way, with no extra
       setup required. */
    var workGroup = $(".click-drop");
    var workLabel = workGroup && workGroup.dataset.selectedLabel;
    var rawMessage = $("#f-msg").value.trim();

    var payload = {
      name:    $("#f-name").value.trim(),
      email:   $("#f-email").value.trim(),
      message: workLabel ? ("Interested in: " + workLabel + "\n\n" + rawMessage) : rawMessage
    };

    sendBtn.disabled = true;
    sendBtn.classList.add("sending");
    sendBtn.textContent = "Sending…";
    setNote("Sending your message…");

    var stored = false;
    var emailed = false;
    var reason = "";

    try {
      if (!supabaseClient) throw new Error("Supabase client is not configured.");

      /* 1 — store the message in the database. */
      var res = await supabaseClient.from(CONTACT_TABLE).insert([payload]);
      if (res.error) throw res.error;
      stored = true;

      /* 2 — ask the Edge Function to email it on. A failure here is not fatal:
             the message is already saved and visible in the Supabase table. */
      if (NOTIFY_FUNCTION) {
        try {
          var fn = await supabaseClient.functions.invoke(NOTIFY_FUNCTION, { body: payload });
          if (fn.error) throw fn.error;
          emailed = true;
        } catch (mailErr) {
          console.warn("[contact] Saved to the database, but the email step failed:", mailErr);
        }
      }
    } catch (err) {
      console.error("[contact] Submission failed:", err);
      reason = (err && err.message) || "Unknown error";
    }

    sendBtn.disabled = false;
    sendBtn.classList.remove("sending");
    sendBtn.textContent = "Send message";

    if (stored && emailed) {
      setNote("Thank you — your message is on its way. I'll come back to you shortly.", "success");
      form.reset();
      $$("[data-field]").forEach(function (f) { f.classList.remove("filled", "invalid"); });
      counter.textContent = "0 / 2000";
      resetWorkPick();
    } else if (stored) {
      setNote("Thank you — your message has been received. I'll come back to you shortly.", "success");
      form.reset();
      $$("[data-field]").forEach(function (f) { f.classList.remove("filled", "invalid"); });
      counter.textContent = "0 / 2000";
      resetWorkPick();
    } else {
      var link = mailto +
        "?subject=" + encodeURIComponent("Website enquiry from " + payload.name) +
        "&body=" + encodeURIComponent(payload.message + "\n\n— " + payload.name + " (" + payload.email + ")");
      setNote(
        "Something went wrong sending that (" + reason + "). " +
        'Please <a href="' + link + '">email it to me directly</a> instead.',
        "error"
      );
    }
  });

  /* Footer year. */
  $("#yr").textContent = new Date().getFullYear();
})();
