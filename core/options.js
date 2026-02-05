// Get references to key DOM elements
const providerSelect = document.getElementById('provider');
const allProviderFields = document.querySelectorAll('.provider-specific');
const saveButton = document.getElementById('saveBtn');
const resetButton = document.getElementById('resetBtn');
const statusMessage = document.getElementById('status');
const providerSettingsCache = {};

/**
 * Updates the visibility of provider-specific input fields based on the selected provider.
 */
function updateProviderFields() {
  const selectedProvider = providerSelect.value;

  allProviderFields.forEach(field => {
    const showFor = field.getAttribute('data-show-for').split(' ');
    if (showFor.includes(selectedProvider)) {
      field.style.display = 'block';
    } else {
      field.style.display = 'none';
    }
  });
}

/**
 * Read provider-specific settings from the form inputs.
 * @returns {{ apiKey: string, baseUrl: string, deployment: string, apiVersion: string, model: string }}
 */
function getProviderSettingsFromForm() {
  return {
    apiKey: document.getElementById("apiKey").value.trim(),
    baseUrl: document.getElementById("baseUrl").value.trim(),
    deployment: document.getElementById("deployment").value.trim(),
    apiVersion: document.getElementById("apiVersion").value.trim(),
    model: document.getElementById("model").value.trim()
  };
}

/**
 * Apply provider-specific settings to the form inputs.
 * @param {{ apiKey?: string, baseUrl?: string, deployment?: string, apiVersion?: string, model?: string }} settings
 */
function applyProviderSettingsToForm(settings) {
  document.getElementById("apiKey").value = settings.apiKey || "";
  document.getElementById("baseUrl").value = settings.baseUrl || "";
  document.getElementById("deployment").value = settings.deployment || "";
  document.getElementById("apiVersion").value = settings.apiVersion || "";
  document.getElementById("model").value = settings.model || "";
}

/**
 * Resets all form fields to their default values and clears the status message.
 */
function resetForm() {
  document.getElementById("provider").value = "openai";
  applyProviderSettingsToForm({});
  document.getElementById("language").value = "english";
  document.getElementById("blacklistedUrls").value = "";

  statusMessage.textContent = "";
  updateProviderFields();
}

/**
 * Loads saved settings from chrome.storage.sync and populates the form fields.
 */
function loadSettings() {
  const fields = ["provider", "providerSettings", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "blacklistedUrls", "defaultBlacklistedUrls"];
  chrome.storage.sync.get(fields, (items) => {
    if (items.provider) document.getElementById("provider").value = items.provider;
    const providerKey = (items.provider || "openai").toLowerCase();
    const providerSettings = items.providerSettings || {};
    Object.assign(providerSettingsCache, providerSettings);
    const selectedSettings = providerSettingsCache[providerKey] || {
      apiKey: items.apiKey || "",
      baseUrl: items.baseUrl || "",
      deployment: items.deployment || "",
      apiVersion: items.apiVersion || "",
      model: items.model || ""
    };
    applyProviderSettingsToForm(selectedSettings);
    if (items.language) document.getElementById("language").value = items.language;
    if (items.blacklistedUrls !== undefined) document.getElementById("blacklistedUrls").value = items.blacklistedUrls;
    if (items.defaultBlacklistedUrls !== undefined) document.getElementById("defaultBlacklistedUrls").value = items.defaultBlacklistedUrls;
    updateProviderFields();
    providerSelect.dataset.currentProvider = providerSelect.value;
  });
}

/**
 * Saves current form settings to chrome.storage.sync.
 */
function saveSettings() {
  const providerKey = providerSelect.value.toLowerCase();
  const providerSpecific = getProviderSettingsFromForm();
  const globalSettings = {
    provider: providerSelect.value,
    language: document.getElementById("language").value.trim(),
    blacklistedUrls: document.getElementById("blacklistedUrls").value.trim(),
    defaultBlacklistedUrls: document.getElementById("defaultBlacklistedUrls").value.trim()
  };

  providerSettingsCache[providerKey] = providerSpecific;

  chrome.storage.sync.set({ ...globalSettings, providerSettings: providerSettingsCache }, () => {
    statusMessage.textContent = "Settings saved! ✅";
    setTimeout(() => { statusMessage.textContent = ""; }, 2000);
  });
}

// --- Event Listeners ---
providerSelect.addEventListener('change', () => {
  const currentProvider = (providerSelect.dataset.currentProvider || providerSelect.value).toLowerCase();
  const nextProvider = providerSelect.value.toLowerCase();
  const currentSettings = getProviderSettingsFromForm();

  providerSettingsCache[currentProvider] = currentSettings;
  const nextSettings = providerSettingsCache[nextProvider] || {};
  applyProviderSettingsToForm(nextSettings);
  chrome.storage.sync.set({ providerSettings: providerSettingsCache }, () => {
    providerSelect.dataset.currentProvider = providerSelect.value;
    updateProviderFields();
  });
});
saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetForm);

// Load settings and update provider fields when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  providerSelect.dataset.currentProvider = providerSelect.value;
});
