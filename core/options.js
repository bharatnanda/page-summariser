import { platform } from './platform.js';

// Get references to key DOM elements
const providerSelect = document.getElementById('provider');
const allProviderFields = document.querySelectorAll('.provider-specific');
const modelPresetSelect = document.getElementById('modelPreset');
const deploymentPresetSelect = document.getElementById('deploymentPreset');
const modelInput = document.getElementById('model');
const deploymentInput = document.getElementById('deployment');
const saveButton = document.getElementById('saveBtn');
const resetButton = document.getElementById('resetBtn');
const statusMessage = document.getElementById('status');
const providerSettingsCache = {};

const MODEL_PRESETS = {
  openai: [
    "gpt-3.5-turbo",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano"
  ],
  gemini: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-pro",
    "gemini-3-flash"
  ]
};

const DEPLOYMENT_PRESETS = {
  azure: [
    "gpt-5.1",
    "gpt-5.1-chat",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-chat",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o-mini"
  ]
};

function populatePresets(selectEl, presets) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "Custom...";
  selectEl.appendChild(customOption);
  presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset;
    option.textContent = preset;
    selectEl.appendChild(option);
  });
}

function populateModelPresets(provider) {
  populatePresets(modelPresetSelect, MODEL_PRESETS[provider] || []);
}

function populateDeploymentPresets(provider) {
  populatePresets(deploymentPresetSelect, DEPLOYMENT_PRESETS[provider] || []);
}

function syncPresetToInput(selectEl, inputEl) {
  if (!selectEl || !inputEl) return;
  const selected = selectEl.value;
  if (selected && selected !== "__custom__") {
    inputEl.value = selected;
  }
}

function syncInputToPreset(selectEl, inputEl, presets) {
  if (!selectEl || !inputEl) return;
  const current = inputEl.value.trim();
  if ((presets || []).includes(current)) {
    selectEl.value = current;
  } else {
    selectEl.value = "__custom__";
  }
}

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
  document.getElementById("promptProfile").value = "default";
  document.getElementById("useExtractionEngine").value = "true";
  document.getElementById("blacklistedUrls").value = "";

  statusMessage.textContent = "";
  updateProviderFields();
  populateModelPresets("openai");
  if (modelInput) {
    modelInput.value = "gpt-5-nano";
  }
  syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS.openai);
  populateDeploymentPresets("azure");
  if (deploymentInput) {
    deploymentInput.value = "gpt-4o-mini";
  }
  syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS.azure);
}

/**
 * Loads saved settings from chrome.storage.sync and populates the form fields.
 */
function loadSettings() {
  const fields = ["provider", "providerSettings", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "promptProfile", "useExtractionEngine", "blacklistedUrls", "defaultBlacklistedUrls"];
  platform.storage.get('sync', fields).then((items) => {
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
    if (!selectedSettings.model && providerKey === "openai" && modelInput) {
      modelInput.value = "gpt-5-nano";
    }
    if (!selectedSettings.model && providerKey === "gemini" && modelInput) {
      modelInput.value = "gemini-2.5-flash";
    }
    if (!selectedSettings.deployment && providerKey === "azure" && deploymentInput) {
      deploymentInput.value = "gpt-4o-mini";
    }
    if (items.language) document.getElementById("language").value = items.language;
    if (items.promptProfile) document.getElementById("promptProfile").value = items.promptProfile;
    if (items.useExtractionEngine !== undefined) {
      document.getElementById("useExtractionEngine").value = String(Boolean(items.useExtractionEngine));
    }
    if (items.blacklistedUrls !== undefined) document.getElementById("blacklistedUrls").value = items.blacklistedUrls;
    if (items.defaultBlacklistedUrls !== undefined) document.getElementById("defaultBlacklistedUrls").value = items.defaultBlacklistedUrls;
    updateProviderFields();
    populateModelPresets(providerKey);
    syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS[providerKey] || []);
    populateDeploymentPresets(providerKey);
    syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS[providerKey] || []);
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
    promptProfile: document.getElementById("promptProfile").value,
    useExtractionEngine: document.getElementById("useExtractionEngine").value === "true",
    blacklistedUrls: document.getElementById("blacklistedUrls").value.trim(),
    defaultBlacklistedUrls: document.getElementById("defaultBlacklistedUrls").value.trim()
  };

  providerSettingsCache[providerKey] = providerSpecific;

  platform.storage.set('sync', { ...globalSettings, providerSettings: providerSettingsCache }).then(() => {
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
  platform.storage.set('sync', { providerSettings: providerSettingsCache }).then(() => {
    providerSelect.dataset.currentProvider = providerSelect.value;
    updateProviderFields();
    populateModelPresets(nextProvider);
    syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS[nextProvider] || []);
    populateDeploymentPresets(nextProvider);
    syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS[nextProvider] || []);
  });
});
modelPresetSelect?.addEventListener("change", () => {
  syncPresetToInput(modelPresetSelect, modelInput);
});
deploymentPresetSelect?.addEventListener("change", () => {
  syncPresetToInput(deploymentPresetSelect, deploymentInput);
});
modelInput?.addEventListener("input", () => {
  const provider = providerSelect.value.toLowerCase();
  syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS[provider] || []);
});
deploymentInput?.addEventListener("input", () => {
  const provider = providerSelect.value.toLowerCase();
  syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS[provider] || []);
});
saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetForm);

// Load settings and update provider fields when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  providerSelect.dataset.currentProvider = providerSelect.value;
});
