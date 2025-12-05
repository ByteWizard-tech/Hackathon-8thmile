// Mobile nav toggle
const navToggle = document.getElementById("navToggle");
const mobileNav = document.getElementById("mobileNav");

navToggle.addEventListener("click", () => {
  const isVisible = mobileNav.style.display === "flex";
  mobileNav.style.display = isVisible ? "none" : "flex";
});

mobileNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileNav.style.display = "none";
  });
});

// --- OPTIONAL: UPLOAD LOGIC (Uncomment to enable) ---
/*
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("screenshotInput");
const statusText = document.getElementById("uploadStatus");

if(uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) { alert("Please select a screenshot first."); return; }

        statusText.textContent = "⏳ Analyzing...";
        statusText.style.color = "var(--warning)";

        const formData = new FormData();
        formData.append("file", file);

        try {
            // REPLACE with your Python Backend URL
            const response = await fetch("http://localhost:8000/analyze", {
                method: "POST",
                body: formData
            });
            if (!response.ok) throw new Error("Analysis failed");
            const data = await response.json(); 
            
            // Auto-fill logic
            if(data.earnings) document.getElementById("earnings").value = data.earnings;
            if(data.hours) document.getElementById("totalHoursOnline").value = data.hours;
            if(data.tasks) document.getElementById("tasksCompleted").value = data.tasks;
            
            statusText.textContent = "✅ Data extracted!";
            statusText.style.color = "#22c55e";
        } catch (error) {
            statusText.textContent = "❌ Failed. Enter manually.";
            statusText.style.color = "var(--danger)";
        }
    });
}
*/
// ----------------------------------------------------

// --- FairPay API-backed analysis ---
const API_BASE = "http://localhost:8000";

const form = document.getElementById("fairPayForm");
const platformEl = document.getElementById("platform");
const gigTypeEl = document.getElementById("gigType");
const cityTierEl = document.getElementById("cityTier");
const vehicleEl = document.getElementById("vehicle");

const shiftCountEl = document.getElementById("shiftCount");
const shiftContainer = document.getElementById("shiftContainer");
const submitBtn = form.querySelector("button[type='submit']");

const results = document.getElementById("results");
const scoreNumber = document.getElementById("scoreNumber");
const scoreLabel = document.getElementById("scoreLabel");
const scoreFill = document.getElementById("scoreFill");
const scoreTag = document.getElementById("scoreTag");
const resultsBody = document.getElementById("resultsBody");
const metricRow = document.getElementById("metricRow");
const rangeRow = document.getElementById("rangeRow");

function normalizeNumber(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(num) {
  if (!isFinite(num)) return "₹ 0";
  return "₹ " + Math.round(num).toLocaleString("en-IN");
}

function formatNumber(num) {
  if (!isFinite(num)) return "0";
  return Number(num.toFixed(1)).toLocaleString("en-IN");
}

function updateScoreChipTone(tone) {
  const dot = scoreTag.querySelector(".score-chip-dot");
  if (!dot) return;

  let color;
  if (tone === "danger") color = "var(--danger)";
  else if (tone === "warning") color = "var(--muted-warning)";
  else if (tone === "amber") color = "var(--warning)";
  else if (tone === "good" || tone === "premium") color = "var(--accent-2)";
  else color = "var(--muted)";

  dot.style.background = color;
  dot.style.boxShadow = `0 0 10px ${color}`;
}
function toneForScore(score) {
  if (score < 35) return { tone: "danger", tag: "Severe risk" };
  if (score < 55) return { tone: "warning", tag: "Underpaid" };
  if (score < 70) return { tone: "amber", tag: "Borderline" };
  if (score < 85) return { tone: "good", tag: "Fair" };
  return { tone: "premium", tag: "Strong" };
}

function renderAnomalies(list) {
  if (!Array.isArray(list) || list.length === 0)
    return "<div>No anomalies reported.</div>";
  return list
    .map((item) => `<div class="anomaly-item">• ${item}</div>`)
    .join("");
}

function renderMetrics(metrics) {
  if (!metrics) return "";
  return `
    <div class="metric-pill">
      <div class="metric-label">Low-rate shifts</div>
      <div class="metric-value">${metrics.suspicious_rate_drops || 0}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-label">Bonus mismatches</div>
      <div class="metric-value">${metrics.bonus_mismatch_count || 0}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-label">Total deductions</div>
      <div class="metric-value">${formatCurrency(
        metrics.total_deductions || 0
      )}</div>
    </div>
  `;
}

function renderPreviewRow(preview) {
  if (!Array.isArray(preview) || preview.length === 0) return "";
  const shift = preview[0];
  const hourly = shift.hourly_rate || 0;
  return `
    <div class="range-pill"><strong>Hourly rate:</strong> ${formatCurrency(
      hourly
    )}</div>
    <div class="range-pill"><strong>Earnings:</strong> ${formatCurrency(
      shift.earnings || 0
    )}</div>
    <div class="range-pill"><strong>Hours online:</strong> ${formatNumber(
      shift.hours_online || 0
    )}</div>
  `;
}

async function callAnalysis(payload) {
  const response = await fetch(`${API_BASE}/analyze-form`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || "Analysis failed");
  }
  return data;
}

function buildShiftGroup(index) {
  return `<details class="shift-group" data-index="${index}" open>
  <summary>Shift ${index}</summary>
  <div class="shift-grid">

    <div class="form-field">
      <label class="label" data-i18n="hoursOnlineLabel">
        Hours online <span>*</span>
      </label>
      <input
        type="number"
        class="shift-input"
        data-field="hours_online"
        min="0.1"
        step="0.1"
        placeholder="e.g. 8"
        data-i18n-placeholder="hoursOnlinePlaceholder"
        required
      />
    </div>

    <div class="form-field">
      <label class="label" data-i18n="tasksCompletedLabel">
        Tasks completed <span>*</span>
      </label>
      <input
        type="number"
        class="shift-input"
        data-field="tasks_completed"
        min="1"
        step="1"
        placeholder="e.g. 15"
        data-i18n-placeholder="tasksCompletedPlaceholder"
        required
      />
    </div>

    <div class="form-field">
      <label class="label" data-i18n="earningsLabel">
        Earnings (₹) <span>*</span>
      </label>
      <input
        type="number"
        class="shift-input"
        data-field="earnings"
        min="0"
        step="50"
        placeholder="e.g. 1800"
        data-i18n-placeholder="earningsPlaceholder"
        required
      />
    </div>

    <div class="form-field">
      <label class="label" data-i18n="bonusesReceivedLabel">
        Bonuses received (₹)
      </label>
      <input
        type="number"
        class="shift-input"
        data-field="bonuses_received"
        min="0"
        step="50"
        placeholder="Actual bonus"
        data-i18n-placeholder="bonusReceivedPlaceholder"
      />
    </div>

    <div class="form-field">
      <label class="label" data-i18n="bonusesExpectedLabel">
        Bonuses expected (₹)
      </label>
      <input
        type="number"
        class="shift-input"
        data-field="bonuses_expected"
        min="0"
        step="50"
        placeholder="Promised bonus"
        data-i18n-placeholder="bonusExpectedPlaceholder"
      />
    </div>

    <div class="form-field">
      <label class="label" data-i18n="deductionsLabel">
        Deductions (₹)
      </label>
      <input
        type="number"
        class="shift-input"
        data-field="deductions"
        min="0"
        step="50"
        placeholder="Penalties / fees"
        data-i18n-placeholder="deductionsPlaceholder"
      />
    </div>

  </div>
</details>
`;
}

function renderShiftGroups(count) {
  const total = Math.max(1, Math.min(10, Number(count) || 1));
  shiftContainer.innerHTML = Array.from({ length: total }, (_, i) =>
    buildShiftGroup(i + 1)
  ).join("");
}

function collectShifts() {
  const groups = Array.from(shiftContainer.querySelectorAll(".shift-group"));
  const shifts = groups.map((group) => {
    const inputs = group.querySelectorAll(".shift-input");
    const obj = {};
    inputs.forEach((input) => {
      const field = input.dataset.field;
      obj[field] = normalizeNumber(input.value);
    });
    // Use bonuses_received if expected is empty
    if (!obj.bonuses_expected && obj.bonuses_received) {
      obj.bonuses_expected = obj.bonuses_received;
    }
    return obj;
  });

  const invalid = shifts.some(
    (s) => !s.earnings || !s.hours_online || !s.tasks_completed
  );
  if (invalid) {
    throw new Error("Please fill earnings, hours, and tasks for every shift.");
  }
  return shifts;
}

// initial render
renderShiftGroups(shiftCountEl.value);
shiftCountEl.addEventListener("change", (e) => {
  renderShiftGroups(e.target.value);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  let shifts;
  try {
    shifts = collectShifts();
  } catch (err) {
    alert(err.message);
    return;
  }

  const payload = { shifts };

  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Analyzing...";

  try {
    const data = await callAnalysis(payload);
    const score = normalizeNumber(data.fairness_score);
    const tone = toneForScore(score);

    results.style.display = "block";
    requestAnimationFrame(() => results.classList.add("visible"));

    scoreNumber.textContent = score;
    scoreTag.querySelector("span:last-child").textContent = tone.tag;
    scoreLabel.textContent = data.anomalies?.[0] || "Analysis complete";
    scoreFill.style.width = `${score}%`;
    updateScoreChipTone(tone.tone);

    resultsBody.innerHTML = `
      <div class="anomaly-list">${renderAnomalies(data.anomalies)}</div>
    `;

    metricRow.innerHTML = renderMetrics(data.metrics);
    const totals = computeTotals(shifts);

    rangeRow.innerHTML = `
  <div class="range-pill"><strong>Total Hours:</strong> ${formatNumber(
    totals.totalHours
  )}</div>
  <div class="range-pill"><strong>Total Earnings:</strong> ${formatCurrency(
    totals.totalEarnings
  )}</div>
  <div class="range-pill"><strong>Avg Hourly Income:</strong> ${formatCurrency(
    totals.hourlyRate
  )}</div>
`;
  } catch (err) {
    alert(err.message || "Something went wrong while analyzing.");
    results.style.display = "none";
    results.classList.remove("visible");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

document.getElementById("resetForm").addEventListener("click", () => {
  form.reset();
  renderShiftGroups(shiftCountEl.value || 1);
  results.style.display = "none";
  results.classList.remove("visible");
  scoreFill.style.width = "0";
});

document.getElementById("quickExample").addEventListener("click", () => {
  shiftCountEl.value = 2;
  renderShiftGroups(2);

  const groups = shiftContainer.querySelectorAll(".shift-group");
  const presets = [
    {
      hours_online: 8,
      tasks_completed: 14,
      earnings: 3200,
      bonuses_received: 400,
      bonuses_expected: 500,
      deductions: 150,
    },
    {
      hours_online: 6,
      tasks_completed: 11,
      earnings: 2400,
      bonuses_received: 250,
      bonuses_expected: 300,
      deductions: 120,
    },
  ];

  groups.forEach((group, idx) => {
    const inputs = group.querySelectorAll(".shift-input");
    inputs.forEach((input) => {
      const field = input.dataset.field;
      input.value = presets[idx]?.[field] ?? "";
    });
  });

  form.dispatchEvent(new Event("submit"));
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ------------------- APPEAL LETTER LOGIC ------------------- */
const generateAppealBtn = document.getElementById("generateAppeal");
const appealModal = document.getElementById("appealModal");
const appealText = document.getElementById("appealText");
const copyAppealBtn = document.getElementById("copyAppeal");
const closeAppealBtn = document.getElementById("closeAppeal");

function openAppealModal() {
  if (!appealModal) return;
  appealModal.style.display = "flex";
  appealModal.classList.add("is-visible");
  document.body.classList.add("modal-open");
}

function closeAppealModal() {
  if (!appealModal) return;
  appealModal.classList.remove("is-visible");
  appealModal.style.display = "none";
  document.body.classList.remove("modal-open");
}

if (generateAppealBtn) {
  generateAppealBtn.addEventListener("click", async () => {
    try {
      const shifts = collectShifts(); // reuse same function

      const response = await fetch(`${API_BASE}/generate-appeal-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts }),
      });

      const data = await response.json();

      if (data.error) {
        alert("Error generating appeal letter: " + data.error);
        return;
      }

      appealText.textContent = data.appeal_letter || "";
      openAppealModal();
    } catch (err) {
      alert("Failed to generate appeal letter: " + err.message);
    }
  });
}

if (copyAppealBtn && appealText) {
  copyAppealBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(appealText.textContent || "");
    copyAppealBtn.textContent = "Copied!";
    setTimeout(() => (copyAppealBtn.textContent = "Copy Letter"), 1500);
  });
}

if (closeAppealBtn) {
  closeAppealBtn.addEventListener("click", () => {
    closeAppealModal();
  });
}

// Close modal when clicking outside the dialog box
if (appealModal) {
  appealModal.addEventListener("click", (event) => {
    if (event.target === appealModal) {
      closeAppealModal();
    }
  });
}

// Close with Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && appealModal?.classList.contains("is-visible")) {
    closeAppealModal();
  }
});

function computeTotals(shifts) {
  let totalHours = 0;
  let totalEarnings = 0;

  shifts.forEach((s) => {
    const earnings = normalizeNumber(s.earnings);
    const bonus = normalizeNumber(s.bonuses_received);
    const deductions = normalizeNumber(s.deductions);
    const hours = normalizeNumber(s.hours_online);

    totalHours += hours;
    totalEarnings += earnings + bonus - deductions;
  });

  const hourlyRate = totalHours > 0 ? totalEarnings / totalHours : 0;

  return {
    totalHours,
    totalEarnings,
    hourlyRate,
  };
}

// ------------------- LANGUAGE / I18N -------------------
const translations = {
  en: {
    analyzerTitle: "FairPay Gig Analyzer",
    analyzerSubtitle: "Estimate fairness based on metrics.",

    heroTitle: "FairPay checks if your gig income is fair.",
    heroSubtitle:
      "For drivers and delivery partners on Ola, Uber, Swiggy, Zomato, Porter, Dunzo and other platforms. Enter your hours online, tasks completed, earnings and costs — get a fairness score and a better target rate.",

    quickExampleBtn: "Try an Ola / Uber example →",
    seeHowBtn: "See how FairPay calculates",

    shiftCountLabel: "Number of shifts *",
    shiftCountPlaceholder: "e.g. 3",

    platformLabel: "Platform *",
    gigTypeLabel: "Type of work *",
    cityLabel: "City *",
    vehicleLabel: "Vehicle type *",

    hoursOnlineLabel: "Hours online *",
    hoursOnlinePlaceholder: "e.g. 8",

    tasksCompletedLabel: "Tasks completed *",
    tasksCompletedPlaceholder: "e.g. 15",

    earningsLabel: "Earnings (₹) *",
    earningsPlaceholder: "e.g. 1800",

    bonusReceivedLabel: "Bonuses received (₹)",
    bonusReceivedPlaceholder: "Actual bonus",

    bonusExpectedLabel: "Bonuses expected (₹)",
    bonusExpectedPlaceholder: "Promised bonus",

    deductionsLabel: "Deductions (₹)",
    deductionsPlaceholder: "Penalties / fees",

    analyzeBtn: "Analyze",
    resetBtn: "Reset",
    appealBtn: "Generate Appeal Letter",

    resultsTitle: "FairPay score",
    resultsSubtitleEmpty: "Fill details and analyze.",
    resultsSubtitleDone: "Analysis complete",
    noAnomalies: "No anomalies reported.",
  },

  hi: {
    analyzerTitle: "FairPay गिग विश्लेषक",
    analyzerSubtitle: "मेट्रिक्स के आधार पर न्यायपूर्ण आय का अनुमान।",

    heroTitle: "FairPay जाँच करता है कि आपकी गिग आय न्यायपूर्ण है या नहीं।",
    heroSubtitle:
      "Ola, Uber, Swiggy, Zomato, Porter, Dunzo और अन्य प्लेटफ़ॉर्म पर ड्राइवर और डिलीवरी पार्टनर के लिए। अपने ऑनलाइन घंटे, किए गए कार्य, कमाई और खर्च दर्ज करें — एक न्यायपूर्णता स्कोर और बेहतर लक्ष्य दर पाएं।",

    quickExampleBtn: "Ola / Uber का उदाहरण आज़माएँ →",
    seeHowBtn: "FairPay कैसे गणना करता है देखें",

    shiftCountLabel: "शिफ़्ट की संख्या *",
    shiftCountPlaceholder: "जैसे 3",

    platformLabel: "प्लेटफ़ॉर्म *",
    gigTypeLabel: "काम का प्रकार *",
    cityLabel: "शहर *",
    vehicleLabel: "वाहन प्रकार *",

    hoursOnlineLabel: "ऑनलाइन घंटे *",
    hoursOnlinePlaceholder: "जैसे 8",

    tasksCompletedLabel: "पूरे किए गए कार्य *",
    tasksCompletedPlaceholder: "जैसे 15",

    earningsLabel: "कुल कमाई (₹) *",
    earningsPlaceholder: "जैसे 1800",

    bonusReceivedLabel: "मिली हुई बोनस राशि (₹)",
    bonusReceivedPlaceholder: "वास्तविक बोनस",

    bonusExpectedLabel: "उम्मीद की गई बोनस राशि (₹)",
    bonusExpectedPlaceholder: "वादा किया हुआ बोनस",

    deductionsLabel: "काटे गए शुल्क / जुर्माने (₹)",
    deductionsPlaceholder: "पेनल्टी / फ़ीस",

    analyzeBtn: "विश्लेषण करें",
    resetBtn: "रीसेट",
    appealBtn: "अपील पत्र बनाएँ",

    resultsTitle: "FairPay स्कोर",
    resultsSubtitleEmpty: "विवरण भरें और विश्लेषण करें।",
    resultsSubtitleDone: "विश्लेषण पूरा हुआ",
    noAnomalies: "कोई अनियमितता नहीं मिली।",
  },

  kn: {
    analyzerTitle: "FairPay ಗಿಗ್ ವಿಶ್ಲೇಷಕ",
    analyzerSubtitle: "ಮೆಟ್ರಿಕ್‌ಗಳ ಆಧಾರದ ಮೇಲೆ ನ್ಯಾಯಸಮ್ಮತ ಆದಾಯ ಅಂದಾಜು.",

    heroTitle: "FairPay ನಿಮ್ಮ ಗಿಗ್ ಆದಾಯ ನ್ಯಾಯಯುತವೇ ಎಂದು ಪರಿಶೀಲಿಸುತ್ತದೆ.",
    heroSubtitle:
      "Ola, Uber, Swiggy, Zomato, Porter, Dunzo ಮತ್ತು ಇತರ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್‌ಗಳ ಚಾಲಕರಿಗೂ ಡೆಲಿವರಿ ಪಾಲುದಾರರಿಗೂ. ನಿಮ್ಮ ಆನ್‌ಲೈನ್ ಗಂಟೆ, ಪೂರ್ಣಗೊಳಿಸಿದ ಕೆಲಸ, ಆದಾಯ ಮತ್ತು ವೆಚ್ಚಗಳನ್ನು ನಮೂದಿಸಿ — ನ್ಯಾಯತೆ ಅಂಕ ಮತ್ತು ಉತ್ತಮ ಗುರಿ ದರವನ್ನು ಪಡೆಯಿರಿ.",

    quickExampleBtn: "Ola / Uber ಉದಾಹರಣೆಯನ್ನು ಪ್ರಯತ್ನಿಸಿ →",
    seeHowBtn: "FairPay ಹೇಗೆ ಲೆಕ್ಕ ಹಾಕುತ್ತದೆ ನೋಡಿ",

    shiftCountLabel: "ಶಿಫ್ಟ್‌ಗಳ ಸಂಖ್ಯೆ *",
    shiftCountPlaceholder: "ಉದಾ. 3",

    platformLabel: "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ *",
    gigTypeLabel: "ಕೆಲಸದ ವಿಧ *",
    cityLabel: "ನಗರ *",
    vehicleLabel: "ವಾಹನದ ವಿಧ *",

    hoursOnlineLabel: "ಆನ್‌ಲೈನ್ ಗಂಟೆಗಳು *",
    hoursOnlinePlaceholder: "ಉದಾ. 8",

    tasksCompletedLabel: "ಪೂರೈಸಿದ ಕಾರ್ಯಗಳು *",
    tasksCompletedPlaceholder: "ಉದಾ. 15",

    earningsLabel: "ಒಟ್ಟು ಆದಾಯ (₹) *",
    earningsPlaceholder: "ಉದಾ. 1800",

    bonusReceivedLabel: "ಪಡೆಯಲಾದ ಬೋನಸ್ (₹)",
    bonusReceivedPlaceholder: "ವಾಸ್ತವಿಕ ಬೋನಸ್",

    bonusExpectedLabel: "ನಿರೀಕ್ಷಿತ ಬೋನಸ್ (₹)",
    bonusExpectedPlaceholder: "ಭರವಸೆ ನೀಡಿದ ಬೋನಸ್",

    deductionsLabel: "ಕಡಿತಗಳು (₹)",
    deductionsPlaceholder: "ದಂಡ / ಶುಲ್ಕ",

    analyzeBtn: "ವಿಶ್ಲೇಷಿಸಿ",
    resetBtn: "ರಿಸೆಟ್",
    appealBtn: "ಅಪೀಲಿನ ಪತ್ರ ರಚಿಸಿ",

    resultsTitle: "FairPay ಅಂಕ",
    resultsSubtitleEmpty: "ವಿವರಗಳನ್ನು ತುಂಬಿ ಬಳಿಕ ವಿಶ್ಲೇಷಿಸಿ.",
    resultsSubtitleDone: "ವಿಶ್ಲೇಷಣೆ ಪೂರ್ಣವಾಗಿದೆ",
    noAnomalies: "ಯಾವುದೇ ಅಸಮಾನತೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
  },
};

let currentLang = "en";

function applyLanguage(lang) {
  currentLang = lang;
  const dict = translations[lang];

  // Elements whose full textContent we replace
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      // keep existing <span> (like "FairPay") if needed
      if (el.tagName === "H1" && key === "heroTitle") {
        const span = el.querySelector("span");
        const textWithoutBrand = dict[key].replace("FairPay", "").trim();
        el.innerHTML = "";
        if (span) {
          el.appendChild(span);
          el.append(" " + textWithoutBrand);
        } else {
          el.textContent = dict[key];
        }
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // Elements whose placeholder we replace
  document.querySelectorAll("[data-i18n-placeholder]").forEach((inputEl) => {
    const key = inputEl.getAttribute("data-i18n-placeholder");
    if (dict[key]) {
      inputEl.placeholder = dict[key];
    }
  });

  // Update buttons that currently have text set in JS (optional)
  const analyzeBtn = document.querySelector(
    "#fairPayForm button[type='submit']"
  );
  if (analyzeBtn && dict.analyzeBtn) analyzeBtn.textContent = dict.analyzeBtn;

  const resetBtn = document.getElementById("resetForm");
  if (resetBtn && dict.resetBtn) resetBtn.textContent = dict.resetBtn;

  const appealBtn = document.getElementById("generateAppeal");
  if (appealBtn && dict.appealBtn) appealBtn.textContent = dict.appealBtn;
}

// Attach click handlers to language buttons
document.addEventListener("DOMContentLoaded", () => {
  const langButtons = document.querySelectorAll(".lang-btn");
  langButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      langButtons.forEach((b) => b.classList.remove("lang-active"));
      btn.classList.add("lang-active");
      applyLanguage(lang);
    });
  });

  // Apply default language once on load
  applyLanguage(currentLang);
});
