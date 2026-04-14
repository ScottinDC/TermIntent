const form = document.querySelector("#compare-form");
const statusEl = document.querySelector("#status");
const resultsSection = document.querySelector("#results-section");
const tableBody = document.querySelector("#results-table tbody");
const recommendationList = document.querySelector("#recommendation-list");
const explanationEl = document.querySelector("#explanation");
const compareButton = document.querySelector("#compare-button");
const keywordDifficultyHeaderEl = document.querySelector("#keyword-difficulty-header");
const cpcHeaderEl = document.querySelector("#cpc-header");
const relatedKeywordHeaderEl = document.querySelector("#related-keyword-header");
const metricTotalTermsEl = document.querySelector("#metric-total-terms");
const metricPrimaryTermEl = document.querySelector("#metric-primary-term");
const metricSecondaryTermEl = document.querySelector("#metric-secondary-term");
const railPrimaryEl = document.querySelector("#rail-primary");
const railSecondaryEl = document.querySelector("#rail-secondary");
const railGoalEl = document.querySelector("#rail-goal");
const passwordInput = document.querySelector("#access-password");
const savePasswordButton = document.querySelector("#save-password-button");
const clearPasswordButton = document.querySelector("#clear-password-button");
const authStatusEl = document.querySelector("#auth-status");

let lastResult = null;
const appConfig = window.TERMINTENT_CONFIG || {};
const apiBaseUrl = String(appConfig.API_BASE_URL || "").trim().replace(/\/$/, "");
const PASSWORD_STORAGE_KEY = "termintent.apiPassword";

function getStoredPassword() {
  try {
    return window.sessionStorage.getItem(PASSWORD_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredPassword(password) {
  try {
    if (password) {
      window.sessionStorage.setItem(PASSWORD_STORAGE_KEY, password);
    } else {
      window.sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
    }
  } catch {
    // Ignore session storage failures.
  }
}

function setAuthStatus(message, tone = "") {
  authStatusEl.textContent = message;
  authStatusEl.className = `auth-status ${tone}`.trim();
}

function syncPasswordUi() {
  const password = getStoredPassword();
  passwordInput.value = password;
  setAuthStatus(password ? "Password saved for this browser session." : "Enter the shared password to run comparisons.", password ? "success" : "");
}

function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

function shouldShowKeywordDifficulty(goal) {
  return goal === "seo_page" || goal === "ad_copy";
}

function shouldShowCpc(goal) {
  return goal === "seo_page" || goal === "ad_copy";
}

function shouldShowRelatedKeywords(goal) {
  return goal === "seo_page" || goal === "ad_copy";
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Insufficient data";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Insufficient data";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatKeywordDifficulty(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Unavailable";
  }

  return formatNumber(value);
}

function getFitLabel(score) {
  if (!Number.isFinite(score)) {
    return "Alignment unclear";
  }

  if (score >= 0.6) {
    return "Strong match";
  }

  if (score >= 0.35) {
    return "Good match";
  }

  return "Weak match";
}

function renderLabel(label) {
  const classMap = {
    Primary: "label-primary",
    Secondary: "label-secondary",
    "Supporting copy only": "label-supporting",
    "Avoid as primary": "label-avoid"
  };

  return `<span class="label-pill ${classMap[label] || "label-supporting"}">${label}</span>`;
}

function formatIntent(intent, score) {
  const label = intent || "Unknown";

  if (!Number.isFinite(score)) {
    return label;
  }

  return `${label}<span class="intent-fit">${getFitLabel(score)} for this goal</span>`;
}

function formatTrendDirection(direction) {
  if (direction === "Up") {
    return "Up ↑";
  }

  if (direction === "Down") {
    return "Down ↓";
  }

  return direction || "Unknown";
}

function formatGoal(value) {
  if (!value) {
    return "Not selected";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function updateSummary(result, payload = {}) {
  const recommendations = result?.recommendations || {};
  const entries = result?.entries || [];
  const primaryTerm = recommendations.primaryTerm || "None yet";
  const secondaryTerm = recommendations.secondaryTerm || "None yet";

  keywordDifficultyHeaderEl.hidden = !shouldShowKeywordDifficulty(payload.goal);
  cpcHeaderEl.hidden = !shouldShowCpc(payload.goal);
  relatedKeywordHeaderEl.hidden = !shouldShowRelatedKeywords(payload.goal);
  metricTotalTermsEl.textContent = String(entries.length);
  metricPrimaryTermEl.textContent = primaryTerm;
  metricSecondaryTermEl.textContent = secondaryTerm;
  railPrimaryEl.textContent = primaryTerm;
  railSecondaryEl.textContent = secondaryTerm;
  railGoalEl.textContent = formatGoal(payload.goal);
}

function renderTable(entries, goal) {
  const showKeywordDifficulty = shouldShowKeywordDifficulty(goal);
  const showCpc = shouldShowCpc(goal);
  const showRelatedKeywords = shouldShowRelatedKeywords(goal);
  keywordDifficultyHeaderEl.hidden = !showKeywordDifficulty;
  cpcHeaderEl.hidden = !showCpc;
  relatedKeywordHeaderEl.hidden = !showRelatedKeywords;

  tableBody.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td>${entry.term}</td>
          <td>${formatNumber(entry.searchVolume)}</td>
          ${showKeywordDifficulty ? `<td>${formatKeywordDifficulty(entry.keywordDifficulty)}</td>` : ""}
          ${showCpc ? `<td>${formatCurrency(entry.cpc)}</td>` : ""}
          <td class="intent-cell">${formatIntent(entry.intent, entry.intentScore)}</td>
          <td>${formatTrendDirection(entry.trendDirection)}</td>
          ${showRelatedKeywords ? `<td>${formatNumber(entry.relatedKeywordCount)}</td>` : ""}
          <td>${renderLabel(entry.recommendationLabel)}</td>
        </tr>
      `
    )
    .join("");
}

function renderRecommendations(recommendations) {
  const items = [
    ["Primary term", recommendations.primaryTerm || "No clear primary recommendation"],
    ["Secondary term", recommendations.secondaryTerm || "No clear secondary recommendation"],
    [
      "Use in supporting copy",
      recommendations.supportingTerms.length ? recommendations.supportingTerms.join(", ") : "None flagged for supporting copy"
    ],
    [
      "Avoid as primary",
      recommendations.avoidAsPrimary.length ? recommendations.avoidAsPrimary.join(", ") : "None"
    ]
  ];

  recommendationList.innerHTML = items
    .map(
      ([label, value]) => `
        <div>
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `
    )
    .join("");
}

async function submitComparison(event) {
  event.preventDefault();
  compareButton.disabled = true;
  resultsSection.classList.add("hidden");
  setStatus("Comparing terms against SEMrush...");

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(buildApiUrl("/api/compare"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Password": getStoredPassword()
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Comparison failed.");
    }

    lastResult = data;
    updateSummary(data, payload);
    renderTable(data.entries, payload.goal);
    renderRecommendations(data.recommendations);
    explanationEl.textContent = data.explanation;
    resultsSection.classList.remove("hidden");
    setStatus("Comparison complete.", "success");
    setAuthStatus("Password accepted.", "success");
  } catch (error) {
    lastResult = null;
    updateSummary(null, payload);
    keywordDifficultyHeaderEl.hidden = !shouldShowKeywordDifficulty(payload.goal);
    cpcHeaderEl.hidden = !shouldShowCpc(payload.goal);
    relatedKeywordHeaderEl.hidden = !shouldShowRelatedKeywords(payload.goal);
    const fallbackMessage = apiBaseUrl
      ? `Comparison failed. Confirm the API is live at ${apiBaseUrl}.`
      : "Comparison failed. Configure TERMINTENT_CONFIG.API_BASE_URL for the hosted frontend.";
    const message = error instanceof TypeError ? fallbackMessage : error.message || fallbackMessage;
    if (/password|unauthorized/i.test(message)) {
      setAuthStatus("Incorrect or missing password.", "error");
    }
    setStatus(message, "error");
  } finally {
    compareButton.disabled = false;
  }
}

function savePassword() {
  setStoredPassword(passwordInput.value.trim());
  syncPasswordUi();
}

function clearPassword() {
  setStoredPassword("");
  syncPasswordUi();
}

form.addEventListener("submit", submitComparison);
savePasswordButton.addEventListener("click", savePassword);
clearPasswordButton.addEventListener("click", clearPassword);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    savePassword();
  }
});
updateSummary();
syncPasswordUi();

if (!apiBaseUrl && window.location.hostname.endsWith("github.io")) {
  setStatus("Set TERMINTENT_CONFIG.API_BASE_URL in config.js before using the GitHub Pages site.", "error");
}
