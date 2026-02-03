// Get references to key DOM elements
const providerSelect = document.getElementById('provider');
const allProviderFields = document.querySelectorAll('.provider-specific');
const saveButton = document.getElementById('saveBtn');
const resetButton = document.getElementById('resetBtn');
const statusMessage = document.getElementById('status');

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
 * Resets all form fields to their default values and clears the status message.
 */
function resetForm() {
  document.getElementById("provider").value = "openai";
  document.getElementById("apiKey").value = "";
  document.getElementById("baseUrl").value = "";
  document.getElementById("deployment").value = "";
  document.getElementById("apiVersion").value = "";
  document.getElementById("model").value = "";
  document.getElementById("temperature").value = "0.7";
  document.getElementById("language").value = "english";
  document.getElementById("blacklistedUrls").value = "";

  statusMessage.textContent = "";
  updateProviderFields();
}

/**
 * Loads saved settings from chrome.storage.sync and populates the form fields.
 */
function loadSettings() {
  const fields = ["provider", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "temperature", "blacklistedUrls", "defaultBlacklistedUrls"];
  chrome.storage.sync.get(fields, (items) => {
    if (items.provider) document.getElementById("provider").value = items.provider;
    if (items.apiKey) document.getElementById("apiKey").value = items.apiKey;
    if (items.baseUrl) document.getElementById("baseUrl").value = items.baseUrl;
    if (items.deployment) document.getElementById("deployment").value = items.deployment;
    if (items.apiVersion) document.getElementById("apiVersion").value = items.apiVersion;
    if (items.model) document.getElementById("model").value = items.model;
    if (items.language) document.getElementById("language").value = items.language;
    if (items.temperature !== undefined) document.getElementById("temperature").value = items.temperature;
    if (items.blacklistedUrls !== undefined) document.getElementById("blacklistedUrls").value = items.blacklistedUrls;
    if (items.defaultBlacklistedUrls !== undefined) document.getElementById("defaultBlacklistedUrls").value = items.defaultBlacklistedUrls;
    updateProviderFields();
  });
}

/**
 * Saves current form settings to chrome.storage.sync.
 */
function saveSettings() {
  const settings = {
    provider: providerSelect.value,
    apiKey: document.getElementById("apiKey").value.trim(),
    baseUrl: document.getElementById("baseUrl").value.trim(),
    deployment: document.getElementById("deployment").value.trim(),
    apiVersion: document.getElementById("apiVersion").value.trim(),
    model: document.getElementById("model").value.trim(),
    language: document.getElementById("language").value.trim(),
    temperature: parseFloat(document.getElementById("temperature").value) || 0.7,
    blacklistedUrls: document.getElementById("blacklistedUrls").value.trim(),
    defaultBlacklistedUrls: document.getElementById("defaultBlacklistedUrls").value.trim()
  };

  chrome.storage.sync.set(settings, () => {
    statusMessage.textContent = "Settings saved! ✅";
    setTimeout(() => { statusMessage.textContent = ""; }, 2000);
  });
}

// --- Event Listeners ---
providerSelect.addEventListener('change', updateProviderFields);
saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetForm);

// Load settings and update provider fields when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
});
