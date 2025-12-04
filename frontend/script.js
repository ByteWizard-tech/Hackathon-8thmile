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

// --- FairPay gig logic (mock model) ---
const form = document.getElementById("fairPayForm");
const platformEl = document.getElementById("platform");
const gigTypeEl = document.getElementById("gigType");
const cityTierEl = document.getElementById("cityTier");
const vehicleEl = document.getElementById("vehicle");

const totalHoursOnlineEl = document.getElementById("totalHoursOnline");
const tasksCompletedEl = document.getElementById("tasksCompleted");
const earningsEl = document.getElementById("earnings");
const bonusesReceivedEl = document.getElementById("bonusesReceived");
const deductionsEl = document.getElementById("deductions");
const platformFeesEl = document.getElementById("platformFees");
const extraCostsEl = document.getElementById("extraCosts");
const ratingEl = document.getElementById("rating");
const cancellationRateEl = document.getElementById("cancellationRate");

const results = document.getElementById("results");
const scoreNumber = document.getElementById("scoreNumber");
const scoreLabel = document.getElementById("scoreLabel");
const scoreFill = document.getElementById("scoreFill");
const scoreTag = document.getElementById("scoreTag");
const resultsBody = document.getElementById("resultsBody");
const metricRow = document.getElementById("metricRow");
const rangeRow = document.getElementById("rangeRow");

// base fair net per hour (₹) by gigType + cityTier
const baseFair = {
  ride: { metro: 290, tier2: 240, tier3: 210 },
  delivery: { metro: 230, tier2: 190, tier3: 170 },
  parcel: { metro: 290, tier2: 240, tier3: 210 },
  other: { metro: 200, tier2: 170, tier3: 150 },
};

// simple vehicle factor
function vehicleFactor(vehicle) {
  if (vehicle === "car" || vehicle === "tempo") return 1.1;
  if (vehicle === "cycle") return 0.9;
  return 1.0;
}

function getBaseFair(gigType, cityTier, vehicle) {
  const type = baseFair[gigType] ? gigType : "other";
  const tierBand = baseFair[type][cityTier] || baseFair[type].metro;
  return tierBand * vehicleFactor(vehicle);
}

function analyzeGigOffer({
  gigType,
  cityTier,
  vehicle,
  totalHoursOnline,
  tasksCompleted,
  earnings,
  bonusesReceived,
  deductions,
  platformFees,
  extraCosts,
}) {
  const totalIncome = earnings + bonusesReceived;
  const totalCosts = deductions + platformFees + extraCosts;
  const netMonthly = totalIncome - totalCosts;

  const hours = totalHoursOnline > 0 ? totalHoursOnline : 0;
  const netPerHour = hours > 0 ? netMonthly / hours : 0;
  const netPerTask = tasksCompleted > 0 ? netMonthly / tasksCompleted : 0;

  const base = getBaseFair(gigType, cityTier, vehicle);
  const fairLow = base * 0.9;
  const fairHigh = base * 1.2;
  const target = base * 1.05;

  let score = 0;
  let ratio = base > 0 ? netPerHour / base : 0;

  if (netPerHour <= 0 || !isFinite(ratio)) {
    score = 0;
  } else if (ratio < 0.6) {
    score = 15 + ratio * 20;
  } else if (ratio < 0.8) {
    score = 30 + (ratio - 0.6) * 75;
  } else if (ratio < 1.0) {
    score = 50 + (ratio - 0.8) * 75;
  } else if (ratio < 1.2) {
    score = 70 + (ratio - 1.0) * 80;
  } else if (ratio < 1.5) {
    score = 86 + (ratio - 1.2) * 40;
  } else {
    score = 100;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let tag, label, tone;
  if (score < 35) {
    tag = "Severe underpay (demo)";
    label =
      "Your net earnings per hour look far below the estimated fair band.";
    tone = "danger";
  } else if (score < 55) {
    tag = "Underpaid (demo)";
    label =
      "You are earning below the fair band; this supports a strong case to negotiate.";
    tone = "warning";
  } else if (score < 70) {
    tag = "Near fair (demo)";
    label = "You are close to the fair range but still have room to negotiate.";
    tone = "amber";
  } else if (score < 85) {
    tag = "Fair & sustainable (demo)";
    label = "Income appears healthy compared to the band for your city.";
    tone = "good";
  } else {
    tag = "Premium (demo)";
    label = "Net hourly earnings are above typical bands.";
    tone = "premium";
  }

  return {
    score,
    tag,
    label,
    tone,
    netPerHour,
    netPerTask,
    netMonthly,
    totalHoursOnline: hours,
    tasksCompleted: tasksCompleted,
    fairLow,
    fairHigh,
    target,
  };
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

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const gigType = gigTypeEl.value;
  const cityTier = cityTierEl.value;
  const vehicle = vehicleEl.value;

  const totalHoursOnline = Number(totalHoursOnlineEl.value);
  const tasksCompleted = Number(tasksCompletedEl.value);
  const earnings = Number(earningsEl.value);
  const bonusesReceived = Number(bonusesReceivedEl.value || 0);
  const deductions = Number(deductionsEl.value || 0);
  const platformFees = Number(platformFeesEl.value || 0);
  const extraCosts = Number(extraCostsEl.value || 0);
  const rating = ratingEl.value ? Number(ratingEl.value) : null;
  const cancellationRate = cancellationRateEl.value
    ? Number(cancellationRateEl.value)
    : null;

  if (
    !gigType ||
    !cityTier ||
    !vehicle ||
    !totalHoursOnline ||
    !tasksCompleted ||
    !earnings
  ) {
    alert("Please fill all required fields.");
    return;
  }

  const result = analyzeGigOffer({
    gigType,
    cityTier,
    vehicle,
    totalHoursOnline,
    tasksCompleted,
    earnings,
    bonusesReceived,
    deductions,
    platformFees,
    extraCosts,
  });

  results.style.display = "block";
  requestAnimationFrame(() => {
    results.classList.add("visible");
  });

  scoreNumber.textContent = result.score;
  scoreTag.querySelector("span:last-child").textContent = result.tag;
  scoreLabel.textContent = result.label;
  scoreFill.style.width = result.score + "%";
  updateScoreChipTone(result.tone);

  let explanation = `
    Based on this <strong>demo model</strong>, your estimated
    <strong>net income</strong> is <strong>${formatCurrency(
      result.netMonthly
    )}</strong>.
    That's roughly <strong>${formatCurrency(
      result.netPerHour
    )} per hour</strong> online.
  `;

  resultsBody.innerHTML = explanation;

  metricRow.innerHTML = `
    <div class="metric-pill">
      <div class="metric-label">Hours online</div>
      <div class="metric-value">${formatNumber(
        result.totalHoursOnline
      )} hrs</div>
    </div>
    <div class="metric-pill">
      <div class="metric-label">Tasks completed</div>
      <div class="metric-value">${result.tasksCompleted.toLocaleString(
        "en-IN"
      )}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-label">Net ₹ per task</div>
      <div class="metric-value">${formatCurrency(result.netPerTask)}</div>
    </div>
  `;

  rangeRow.innerHTML = `
    <div class="range-pill"><strong>Fair band:</strong> ${formatCurrency(
      result.fairLow
    )} – ${formatCurrency(result.fairHigh)}</div>
    <div class="range-pill"><strong>Your hourly:</strong> ${formatCurrency(
      result.netPerHour
    )}</div>
  `;
});

document.getElementById("resetForm").addEventListener("click", () => {
  form.reset();
  results.style.display = "none";
  results.classList.remove("visible");
  scoreFill.style.width = "0";
});

document.getElementById("quickExample").addEventListener("click", () => {
  platformEl.value = "ola";
  gigTypeEl.value = "ride";
  cityTierEl.value = "metro";
  vehicleEl.value = "car";
  totalHoursOnlineEl.value = 230;
  tasksCompletedEl.value = 340;
  earningsEl.value = 78000;
  bonusesReceivedEl.value = 9000;
  deductionsEl.value = 6000;
  platformFeesEl.value = 8000;
  extraCostsEl.value = 15000;
  ratingEl.value = 4.6;
  cancellationRateEl.value = 10;
  form.dispatchEvent(new Event("submit"));
  window.scrollTo({ top: 0, behavior: "smooth" });
});
