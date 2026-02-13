import { platform } from './platform.js';
import { showNotification } from './utils/notification.js';
import { applyTheme, loadThemeAndApply } from './utils/theme.js';

// Get references to key DOM elements
const providerSelect = document.getElementById('provider');
const allProviderFields = document.querySelectorAll('.provider-specific');
const modelPresetSelect = document.getElementById('modelPreset');
const deploymentPresetSelect = document.getElementById('deploymentPreset');
const modelInput = document.getElementById('model');
const deploymentInput = document.getElementById('deployment');
const modelInputRow = document.getElementById('modelInputRow');
const deploymentInputRow = document.getElementById('deploymentInputRow');
const modelPresetHint = document.getElementById('modelPresetHint');
const modelPresetValue = document.getElementById('modelPresetValue');
const deploymentPresetHint = document.getElementById('deploymentPresetHint');
const deploymentPresetValue = document.getElementById('deploymentPresetValue');
const saveButton = document.getElementById('saveBtn');
const resetButton = document.getElementById('resetBtn');
const notification = document.getElementById('notification');
const themeSelect = document.getElementById('theme');
const syncApiKeysCheckbox = document.getElementById('syncApiKeys');
const useDefaultBlacklistCheckbox = document.getElementById('useDefaultBlacklist');
const toggleDefaultBlacklistButton = document.getElementById('toggleDefaultBlacklist');
const defaultBlacklistTextarea = document.getElementById('defaultBlacklistedUrls');
const providerSettingsCache = {};
const providerApiKeysCache = {};

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
  ollama: "gemma3n"
};
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

function stripApiKeysFromProviderSettings(providerSettings) {
  const cleaned = {};
  Object.entries(providerSettings || {}).forEach(([key, value]) => {
    if (value && typeof value === "object") {
      const { apiKey, ...rest } = value;
      cleaned[key] = rest;
    } else {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

function migrateLegacyApiKeys(syncItems, providerSettingsCache, providerApiKeysCache) {
  if (!syncItems) return;

  const legacyKeys = {};
  const providerSettings = syncItems.providerSettings || {};
  Object.entries(providerSettings).forEach(([provider, settings]) => {
    if (settings?.apiKey) {
      legacyKeys[provider] = settings.apiKey;
    }
  });
  if (syncItems.apiKey && !legacyKeys.openai) {
    legacyKeys.openai = syncItems.apiKey;
  }
  Object.assign(legacyKeys, syncItems.providerApiKeys || {});

  const mergedKeys = { ...providerApiKeysCache, ...legacyKeys };
  providerApiKeysCache && Object.assign(providerApiKeysCache, mergedKeys);

  const cleanedProviderSettings = stripApiKeysFromProviderSettings(providerSettingsCache);
  Object.assign(providerSettingsCache, cleanedProviderSettings);

  const syncWrites = {
    providerSettings: cleanedProviderSettings,
    apiKey: ""
  };
  if (syncItems.syncApiKeys) {
    syncWrites.providerApiKeys = mergedKeys;
  } else {
    syncWrites.providerApiKeys = {};
  }

  Promise.all([
    platform.storage.set('local', { providerApiKeys: mergedKeys }),
    platform.storage.set('sync', syncWrites)
  ]).catch((error) => {
    console.warn("Failed to migrate legacy API keys:", error);
  });
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

function updatePresetUi() {
  const provider = providerSelect.value.toLowerCase();
  const hasModelPreset = (MODEL_PRESETS[provider] || []).length > 0;
  const modelPreset = modelPresetSelect?.value || "__custom__";
  const modelIsPreset = modelPreset !== "__custom__" && hasModelPreset;
  const modelAllowed = ["openai", "gemini", "ollama"].includes(provider);
  if (modelInputRow) {
    modelInputRow.style.display = modelAllowed ? (modelIsPreset ? "none" : "block") : "none";
  }
  if (modelPresetHint && modelPresetValue) {
    modelPresetHint.hidden = !modelIsPreset || !modelAllowed;
    modelPresetValue.textContent = modelIsPreset ? modelPreset : "";
  }

  const deploymentPreset = deploymentPresetSelect?.value || "__custom__";
  const deploymentIsPreset = deploymentPreset !== "__custom__";
  const deploymentAllowed = provider === "azure";
  if (deploymentInputRow) {
    deploymentInputRow.style.display = deploymentAllowed ? (deploymentIsPreset ? "none" : "block") : "none";
  }
  if (deploymentPresetHint && deploymentPresetValue) {
    deploymentPresetHint.hidden = !deploymentIsPreset || !deploymentAllowed;
    deploymentPresetValue.textContent = deploymentIsPreset ? deploymentPreset : "";
  }
}

function ensureDefaultsForProvider(provider) {
  const presets = MODEL_PRESETS[provider] || [];
  const defaultModel = DEFAULT_MODELS[provider] || "";
  if (modelInput && presets.length) {
    const current = modelInput.value.trim();
    if (!presets.includes(current) && defaultModel) {
      modelInput.value = defaultModel;
      syncInputToPreset(modelPresetSelect, modelInput, presets);
    }
  }

  if (provider === "azure" && deploymentInput) {
    const deploymentPresets = DEPLOYMENT_PRESETS.azure || [];
    const currentDeployment = deploymentInput.value.trim();
    const fallback = deploymentPresets.includes("gpt-4o-mini")
      ? "gpt-4o-mini"
      : (deploymentPresets[0] || "");
    if (!deploymentPresets.includes(currentDeployment) && fallback) {
      deploymentInput.value = fallback;
      syncInputToPreset(deploymentPresetSelect, deploymentInput, deploymentPresets);
    }
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

  updatePresetUi();
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
  if (themeSelect) {
    themeSelect.value = "light";
    applyTheme("light");
  }
  document.getElementById("useExtractionEngine").value = "true";
  document.getElementById("blacklistedUrls").value = "";
  if (useDefaultBlacklistCheckbox) {
    useDefaultBlacklistCheckbox.checked = true;
  }
  if (defaultBlacklistTextarea) {
    defaultBlacklistTextarea.hidden = true;
  }
  if (toggleDefaultBlacklistButton) {
    toggleDefaultBlacklistButton.textContent = "Show defaults";
    toggleDefaultBlacklistButton.disabled = false;
  }
  if (syncApiKeysCheckbox) {
    syncApiKeysCheckbox.checked = false;
  }

  
  updateProviderFields();
  populateModelPresets("openai");
  if (modelInput) {
    modelInput.value = DEFAULT_MODELS.openai;
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
  const fields = ["provider", "providerSettings", "apiKey", "baseUrl", "deployment", "apiVersion", "model", "language", "promptProfile", "theme", "useExtractionEngine", "blacklistedUrls", "defaultBlacklistedUrls", "syncApiKeys"];
  Promise.all([
    platform.storage.get('sync', [...fields, 'providerApiKeys']),
    platform.storage.get('local', ['providerApiKeys'])
  ]).then(([items, localItems]) => {
    if (items.provider) document.getElementById("provider").value = items.provider;
    const providerKey = (items.provider || providerSelect.value || "openai").toLowerCase();
    const providerSettings = items.providerSettings || {};
    Object.assign(providerSettingsCache, providerSettings);
    const providerApiKeys = localItems.providerApiKeys || {};
    Object.assign(providerApiKeysCache, providerApiKeys);
    migrateLegacyApiKeys(items, providerSettingsCache, providerApiKeysCache);

    const syncedApiKeys = items.providerApiKeys || {};
    const apiKey = providerApiKeysCache[providerKey] || (items.syncApiKeys ? (syncedApiKeys[providerKey] || providerSettingsCache[providerKey]?.apiKey || items.apiKey || "") : "");
    const selectedSettings = providerSettingsCache[providerKey] || {
      baseUrl: items.baseUrl || "",
      deployment: items.deployment || "",
      apiVersion: items.apiVersion || "",
      model: items.model || ""
    };
    applyProviderSettingsToForm({ ...selectedSettings, apiKey });
    if (!selectedSettings.model && modelInput) {
      modelInput.value = DEFAULT_MODELS[providerKey] || "";
    }
    if (!selectedSettings.deployment && providerKey === "azure" && deploymentInput) {
      deploymentInput.value = "gpt-4o-mini";
    }
    if (items.language) document.getElementById("language").value = items.language;
    if (items.promptProfile) document.getElementById("promptProfile").value = items.promptProfile;
    if (themeSelect) {
      themeSelect.value = items.theme || "light";
      applyTheme(themeSelect.value);
    }
    if (items.useExtractionEngine !== undefined) {
      document.getElementById("useExtractionEngine").value = String(Boolean(items.useExtractionEngine));
    }
    if (items.blacklistedUrls !== undefined) document.getElementById("blacklistedUrls").value = items.blacklistedUrls;
    if (items.defaultBlacklistedUrls !== undefined) defaultBlacklistTextarea.value = items.defaultBlacklistedUrls;
    if (useDefaultBlacklistCheckbox) {
      useDefaultBlacklistCheckbox.checked = Boolean((items.defaultBlacklistedUrls || "").trim());
    }
    if (defaultBlacklistTextarea) {
      defaultBlacklistTextarea.hidden = true;
    }
    if (toggleDefaultBlacklistButton) {
      toggleDefaultBlacklistButton.textContent = "Show defaults";
      toggleDefaultBlacklistButton.disabled = !useDefaultBlacklistCheckbox?.checked;
    }
    if (syncApiKeysCheckbox) {
      syncApiKeysCheckbox.checked = Boolean(items.syncApiKeys);
    }
    updateProviderFields();
    populateModelPresets(providerKey);
    syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS[providerKey] || []);
    populateDeploymentPresets(providerKey);
    syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS[providerKey] || []);
    providerSelect.dataset.currentProvider = providerSelect.value;
    ensureDefaultsForProvider(providerKey);
    updatePresetUi();
  });
}

/**
 * Saves current form settings to chrome.storage.sync.
 */
function saveSettings() {
  const providerKey = providerSelect.value.toLowerCase();
  const providerSpecific = getProviderSettingsFromForm();
  const { apiKey, ...providerSpecificNoKey } = providerSpecific;
  const globalSettings = {
    provider: providerSelect.value,
    language: document.getElementById("language").value.trim(),
    promptProfile: document.getElementById("promptProfile").value,
    theme: themeSelect?.value || "light",
    useExtractionEngine: document.getElementById("useExtractionEngine").value === "true",
    blacklistedUrls: document.getElementById("blacklistedUrls").value.trim(),
    defaultBlacklistedUrls: useDefaultBlacklistCheckbox?.checked
      ? defaultBlacklistTextarea.value.trim()
      : "",
    syncApiKeys: Boolean(syncApiKeysCheckbox?.checked)
  };

  providerSettingsCache[providerKey] = providerSpecificNoKey;
  providerApiKeysCache[providerKey] = apiKey;

  const syncWrites = { ...globalSettings, providerSettings: providerSettingsCache };
  if (syncApiKeysCheckbox?.checked) {
    syncWrites.providerApiKeys = providerApiKeysCache;
  } else {
    syncWrites.providerApiKeys = {};
  }

  Promise.all([
    platform.storage.set('sync', syncWrites),
    platform.storage.set('local', { providerApiKeys: providerApiKeysCache })
  ]).then(() => {
    
    showNotification(notification, "Settings saved!", "success");
  }).catch((error) => {
    console.error("Failed to save settings:", error);
    showNotification(notification, "Failed to save settings", "error");
  });
}

// --- Event Listeners ---
providerSelect.addEventListener('change', () => {
  const currentProvider = (providerSelect.dataset.currentProvider || providerSelect.value).toLowerCase();
  const nextProvider = providerSelect.value.toLowerCase();
  const currentSettings = getProviderSettingsFromForm();

  const { apiKey, ...currentNoKey } = currentSettings;
  providerSettingsCache[currentProvider] = currentNoKey;
  providerApiKeysCache[currentProvider] = apiKey;

  const nextSettings = providerSettingsCache[nextProvider] || {};
  const nextApiKey = providerApiKeysCache[nextProvider] || "";
  applyProviderSettingsToForm({ ...nextSettings, apiKey: nextApiKey });
  platform.storage.set('sync', { providerSettings: providerSettingsCache }).then(() => {
    providerSelect.dataset.currentProvider = providerSelect.value;
    updateProviderFields();
    populateModelPresets(nextProvider);
    syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS[nextProvider] || []);
    populateDeploymentPresets(nextProvider);
    syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS[nextProvider] || []);
    ensureDefaultsForProvider(nextProvider);
    updatePresetUi();
  });
});
modelPresetSelect?.addEventListener("change", () => {
  syncPresetToInput(modelPresetSelect, modelInput);
  updatePresetUi();
});
deploymentPresetSelect?.addEventListener("change", () => {
  syncPresetToInput(deploymentPresetSelect, deploymentInput);
  updatePresetUi();
});
modelInput?.addEventListener("input", () => {
  const provider = providerSelect.value.toLowerCase();
  syncInputToPreset(modelPresetSelect, modelInput, MODEL_PRESETS[provider] || []);
  updatePresetUi();
});
deploymentInput?.addEventListener("input", () => {
  const provider = providerSelect.value.toLowerCase();
  syncInputToPreset(deploymentPresetSelect, deploymentInput, DEPLOYMENT_PRESETS[provider] || []);
  updatePresetUi();
});
saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetForm);
themeSelect?.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});
toggleDefaultBlacklistButton?.addEventListener("click", () => {
  if (!defaultBlacklistTextarea || !toggleDefaultBlacklistButton) return;
  const isHidden = defaultBlacklistTextarea.hidden;
  defaultBlacklistTextarea.hidden = !isHidden;
  toggleDefaultBlacklistButton.textContent = isHidden ? "Hide defaults" : "Show defaults";
});

useDefaultBlacklistCheckbox?.addEventListener("change", () => {
  if (!useDefaultBlacklistCheckbox || !defaultBlacklistTextarea || !toggleDefaultBlacklistButton) return;
  const enabled = useDefaultBlacklistCheckbox.checked;
  if (!enabled) {
    defaultBlacklistTextarea.hidden = true;
    toggleDefaultBlacklistButton.textContent = "Show defaults";
  }
  toggleDefaultBlacklistButton.disabled = !enabled;
});

// Load settings and update provider fields when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  loadThemeAndApply().then(() => loadSettings());
  providerSelect.dataset.currentProvider = providerSelect.value;
});
