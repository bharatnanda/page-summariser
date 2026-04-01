# Page Summarizer Browser Extension

A cross‑browser extension that summarizes web pages using OpenAI, Anthropic, Google Gemini, Azure AI Foundry, or Ollama.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Supported AI Providers](#supported-ai-providers)
- [Usage](#usage)
- [Configuration](#configuration)
- [Privacy](#privacy)
- [Development](#development)
- [Known Limitations](#known-limitations)

## Features

- **Multi-Provider AI Support**: Works with OpenAI, Anthropic, Google Gemini, Azure AI Foundry, and Ollama
- **Content Extraction**: Automatically extracts text content from web pages
- **Smart Summarization**: Generates concise, well-structured summaries
- **Streaming Summaries**: Watch summaries appear in real time for supported providers
- **Text-to-Speech**: Listen to any summary using the built-in player — play, pause, adjust speed, or have it speak automatically as the summary streams in
- **Math Rendering**: Renders LaTeX formulas in summaries using KaTeX (supports `$...$`, `$$...$$`, `\(...\)`, `\[...\]`)
- **History Tracking**: Keeps track of your previous summaries with search, preview, and per-provider deduplication
- **Caching**: Caches summaries for 30 minutes to reduce API usage
- **Domain Blacklisting**: Prevents summarization on restricted domains with a comprehensive default list for security and privacy
- **Multi-Language Support**: Summarize content in multiple languages
- **Auto Light/Dark Mode**: Automatically adapts to your system theme
- **Responsive Design**: Works on all device sizes
- **Consistent Toasts**: In-page toast messages for success/error feedback across browsers

## Installation

1. Download or clone this repository
2. Build the extension for your target browser (see Development → Build)
3. Load the built extension:
   - **Chrome/Edge**: open `chrome://extensions` or `edge://extensions`, enable Developer mode, click "Load unpacked", choose `dist/chrome/`
   - **Firefox**: open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add‑on…", choose any file inside `dist/firefox/`
   - **Safari**: convert `dist/safari/` using `safari-web-extension-converter` and build/run in Xcode (steps below)
4. Also available on Chrome Web Store and Mozilla Addons Store
   - **Chrome / Edge**: [Chrome Web Store – Page Summarizer](https://chromewebstore.google.com/detail/page-summarizer/ehnjnlmphpcoijjahimaggoccnjdhaml)
   - **Firefox**: [Mozilla Add-ons – Page Summarizer Extension](https://addons.mozilla.org/en-US/firefox/addon/page-summarizer-extension/)

## Supported AI Providers

### OpenAI
- **API Key Required**: Yes
- **Default Model**: gpt-4o-mini
- **Base URL**: https://api.openai.com/v1 (also accepts full endpoint URLs)
- **API**: Uses the OpenAI Responses API for both streaming and non-streaming requests
- **Model Presets**: gpt-4o-mini, gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-3.5-turbo, and more

### Anthropic
- **API Key Required**: Yes
- **Default Model**: claude-haiku-4-5-20251001
- **API**: Uses the Anthropic Messages API with streaming support
- **Model Presets**: claude-haiku-4-5-20251001 (fast), claude-sonnet-4-6 (balanced), claude-opus-4-6 (most capable)

### Google Gemini
- **API Key Required**: Yes
- **Default Model**: gemini-2.5-flash
- **Base URL**: https://generativelanguage.googleapis.com/v1beta
- **Model Presets**: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite, and more

### Azure AI Foundry
- **API Key Required**: Yes
- **Base URL**: Your Azure AI Services endpoint (e.g. `https://your-resource.services.ai.azure.com`)
- **API Version**: e.g. `2024-05-01-preview`
- **Model**: Specify by name in the Model field — no deployment name needed
- **Supported Models**: Any model deployed on Azure AI Foundry, including OpenAI models (GPT-4o, GPT-4.1), Anthropic Claude (claude-sonnet-4-6, claude-haiku-4-5-20251001), Meta Llama, Mistral, and others
- **API**: Uses the Azure AI Foundry unified inference endpoint (`/models/chat/completions`)

> **Migrating from Azure OpenAI?** If you previously used the Azure OpenAI provider (with a deployment name and `*.openai.azure.com` endpoint), you will see a migration notice in Settings. Update your Base URL to your Azure AI Foundry endpoint and set a Model name instead of a deployment name. The extension will automatically clear the old deployment field.

### Ollama (Local)
- **API Key Required**: No
- **Default Model**: gemma3n
- **Base URL**: http://localhost:11434
- **Note**: Requires Ollama to be installed and running locally. If calling from a browser extension, set `export OLLAMA_ORIGINS="*"` before starting Ollama.

## Usage

### Summarizing a Page
1. Navigate to any web page you want to summarize
2. Click the Page Summarizer icon in your browser toolbar
3. Click "Summarize This Page"
4. View the generated summary in a new tab

### Viewing History
1. Click the Page Summarizer icon in your browser toolbar
2. Click "History" to see your previous summaries
3. Use the search bar to filter by title, domain, or content
4. Click any entry to view the full summary
5. Use the delete button to remove individual summaries

### Managing Settings
1. Click the Page Summarizer icon in your browser toolbar
2. Click "Settings" to configure the extension
3. Select your preferred AI provider and configure settings

## Configuration

### Provider Settings
- **Provider**: Select from OpenAI, Anthropic, Gemini, Azure AI Foundry, or Ollama
- **API Key**: Your API key for the selected provider (not required for Ollama)
- **Base URL**: Custom endpoint URL (required for Azure AI Foundry and Ollama)
- **Model Name**: Specify which model to use — choose from presets or enter a custom name
- **Provider-Scoped Storage**: Each provider keeps its own saved credentials and model settings independently

### API Key Storage
- API keys are stored locally by default
- You can opt in to sync keys across devices with the "Sync API keys across devices" toggle

### Provider-Specific Settings
- **Anthropic**: API key + model name only — no custom endpoint needed
- **Azure AI Foundry**: Requires Base URL, API Version, and Model name (no deployment name)
- **Ollama**: Can run entirely locally without an API key

### Text-to-Speech
The results page includes a built-in TTS player powered by the browser's native Web Speech API — no external libraries or API keys required.

- **Listen button**: A speaker icon in the results header activates the player. It is disabled while a summary is streaming and becomes available as soon as the full summary is ready.
- **Player controls**: Play/Pause, elapsed time, progress bar, and speed selector (0.75×, 1×, 1.25×, 1.5×, 2×). Close the player with the ✕ button.
- **Stream-along mode**: Enable *"Start speaking while summary streams in"* in Settings → Text-to-Speech. When on, the player appears automatically and speaks completed sentences as they arrive from the AI, without waiting for the full summary.
- **Voice**: Uses the system default voice. On macOS and iOS, this is typically a high-quality neural voice. On Windows/Android, quality varies by device.
- **Availability**: Hidden automatically on browsers that do not support the Web Speech API.

### History Deduplication
The extension uses smart deduplication to avoid saving duplicate summaries:
- Same URL + same provider + same model within 10 minutes → blocked as duplicate (prevents accidental double-saves)
- Same URL but different provider or model → always saved as a new entry (intentional re-summarization)
- Identical summary content → always blocked regardless of provider

### Language Settings
- Choose the language for generated summaries:
  - English (default)
  - Mandarin Chinese
  - Hindi
  - Spanish
  - French
  - Arabic
  - Russian
  - Portuguese
  - Bengali
  - Japanese
  - German
  - Swedish

### Domain Blacklisting
- Prevent summarization on specific domains
- Use semicolon-separated list with wildcards (e.g., `*.mail.google.com;*.accounts.google.com`)
- Enable "Include recommended defaults" in Settings to use the built-in list
- Click "Show defaults" to preview the list (read-only)

### Default Blacklisted Domains
The extension comes with a comprehensive list of default blacklisted domains for security and privacy reasons:

- **Email Services**: Gmail (mail.google.com, inbox.google.com), Outlook, Yahoo Mail, iCloud Mail, ProtonMail, Zoho Mail, Yandex Mail, AOL, FastMail
- **Cloud Storage**: Dropbox, Box, SharePoint, Microsoft Teams
- **Financial Services**: PayPal, Stripe, Chase, Wells Fargo, Bank of America, Citi, Capital One, TD Bank, HSBC, Barclays, NatWest, Lloyds Bank, Santander, Credit Suisse, UBS, ING, Deutsche Bank, Societe Generale, UniCredit, State Bank of India, HDFC Bank, ICICI Bank, Axis Bank, Kotak Mahindra, Yes Bank, IndusInd Bank, Bank of Baroda, PNB, IDBI
- **Government and Military**: All .gov, .gov.* and .mil domains
- **Tax Services**: All .tax.* domains

These domains are blacklisted by default to protect sensitive information. Users can modify this list in the extension settings if needed.

## Privacy

### Data Handling
- All data is processed locally in your browser
- No personal information is collected or transmitted
- Content is sent directly to your chosen AI provider

### Storage
- Summaries are stored locally in your browser's storage
- Settings are synchronized across your browser profile (when sync storage is available)
- No data is shared with third parties

### API Keys
- API keys are stored securely in the browser's local storage by default
- Keys are only used to authenticate with your chosen AI provider
- We never see or store your API keys on our servers

### Detailed Privacy Information
For complete information about how we handle your data, please read our [Privacy Policy](PRIVACY_POLICY.md).

### Data Flow

1. User initiates summarization via popup or context menu
2. Background script extracts page text (selection first, then full page) via the scripting API
3. Background script checks cache for an existing summary
4. If not cached, content is sent to the selected AI provider
5. Summary streams back to the results page in real time
6. Summary is displayed with title/source metadata
7. Summary is saved to history and cache

## Development

### Prerequisites
- Node.js (for build scripts)

### Multi-Platform Builds

The extension code lives in `core/` and is built per platform using `platforms/<platform>/manifest.json`.

Build outputs go to `dist/<platform>/`.

#### Build for Chrome

```
npm run build:chrome
```

Load `dist/chrome/` as an unpacked extension in Chrome/Edge.

#### Build for Firefox

```
npm run build:firefox
```

Load `dist/firefox/` as a temporary add-on in `about:debugging`, or zip the folder for AMO submission.

#### Build for Safari

```
npm run build:safari
```

Then convert the WebExtension bundle to a Safari App:

```
xcrun safari-web-extension-converter dist/safari --project-location safari-app --non-interactive
```

Open the generated Xcode project in `safari-app/`, enable the extension, and build/run.

#### Clean build artifacts

```
npm run clean
```

#### Build all platforms

```
npm run build:all
```

#### Run tests

```
npm test
```

#### Platform Overrides

If you need platform-specific changes, place files in:

```
platforms/<platform>/overrides/
```

Those files override `core/` during the build.

### Adding New Providers

1. Create a new client in `core/utils/api/` (e.g., `newProviderClient.js`) exporting `callNewProvider(prompt, settings, signal)` and `callNewProviderStream(prompt, settings, onDelta, signal)`
2. Register both functions in `core/utils/apiClient.js` (add a `case` to both switch statements)
3. Add response extraction logic to `core/utils/responseParser.js`
4. Add the provider button to the segment control in `core/options.html` and a matching `<option>` in the hidden `<select>`
5. Add model presets and a default model to `core/options.js`
6. Add the provider's API hostname to `host_permissions` in `platforms/chrome/manifest.json`

### Customization

#### Styling
- Modify `core/assets/styles.css` for global styles — uses CSS custom properties for theming with automatic light/dark mode via `prefers-color-scheme`
- Update individual HTML files for page-specific styles

#### Prompt Engineering
- Modify `core/utils/promptBuilder.js` to change summarization behavior
- Adjust rules for content inclusion/exclusion

#### Error Handling
- Customize error messages in provider-specific clients
- Modify toast behavior in `popup.js`, `results.js`, and `history.js`

## Troubleshooting

### Common Issues

#### "API Key Missing" Error
- Ensure you've entered your API key in Settings
- Verify the API key is correct and active

#### "Settings need to be updated" Error (Azure)
- This appears when your Azure config uses the old Azure OpenAI format (deployment name + `*.openai.azure.com` endpoint)
- Open Settings, select **Azure AI Foundry**, and update:
  - **Base URL** → your Azure AI Services endpoint (e.g. `https://your-resource.services.ai.azure.com`)
  - **Model** → the model name you have deployed (e.g. `gpt-4o-mini` or `claude-sonnet-4-6`)
  - **API Version** → `2024-05-01-preview`
  - Remove any value from the Deployment Name field (no longer used)

#### "Unable to Connect to Ollama" Error
- Ensure Ollama is installed and running
- Check that Ollama is accessible at http://localhost:11434
- If requests fail from the extension, set `export OLLAMA_ORIGINS="*"` and restart Ollama

#### "Invalid API Key" Error
- Verify your API key is correct
- Check that your API key has the required permissions

#### "No Content Found" Error
- Try refreshing the page
- Some pages may not be compatible with content extraction

#### Streaming Not Working on Safari
- This is expected behaviour. Safari's extension service worker has a confirmed WebKit bug that prevents `ReadableStream` from working correctly in that context.
- The extension automatically falls back to a non-streaming request on Safari — the full summary will appear at once after a short wait.
- See [Known Limitations → Safari: Streaming Disabled](#safari-streaming-disabled) for full details and tracking references.

### Getting Help
If you encounter issues not covered in this documentation:
1. Check the browser console for error messages
2. Verify your API provider settings
3. Ensure your API key is valid and has sufficient credits

## Known Limitations

### Safari: Streaming Disabled

Real-time streaming is **disabled on Safari** and falls back to a non-streaming request (the full summary appears at once after a short wait). This is not a product decision — it is forced by a confirmed WebKit bug in Safari's extension service worker implementation.

#### Why streaming is broken on Safari

The streaming flow works by calling `response.body.getReader()` inside the extension's **background service worker** to read SSE chunks as they arrive from the AI provider, then forwarding each chunk to the results page via a `runtime.Port`. This pattern works correctly on Chrome and Firefox.

On Safari, the background script runs as a **Manifest V3 service worker** (`safari-web-extension://` origin). WebKit's service worker implementation has several unresolved bugs that break this pattern:

| Bug | Status | Fix |
|---|---|---|
| `ReadableStream` cancel never called inside a service worker | Fixed in Safari TP 216 (Apr 2025) | Shipping in **Safari 26** |
| `ReadableStream` cannot be transferred via `postMessage()` — throws `DataCloneError` | Fixed in Safari TP 238 (Feb 2026) | Not yet in stable |
| Cross-origin `fetch()` CORS failures from `safari-web-extension://` origin in service workers | Partially addressed | Ongoing |
| `ReadableStream` as a fetch request body (`duplex: 'half'`) not supported | Not yet implemented | No ETA |

`response.body.getReader()` itself works fine in **regular browser tab contexts** (e.g., an extension HTML page). The failures are specific to the service worker scope.

#### Current behaviour

- `platform.isSafari` is detected via User-Agent in [platform.js](core/platform.js)
- `settings.disableStreamingOnSafari` is set to `true` whenever `platform.isSafari` is true ([settings.js](core/utils/settings.js))
- [background.js](core/background.js) checks this flag and routes to `summarySession.runNonStreaming()` instead of the streaming path

#### When will it be fixed?

Apple is incrementally fixing these issues. The critical `ReadableStream` cancel fix landed in **Safari 26 beta** (announced at WWDC25, June 2025), and the `postMessage` transfer fix is in **Safari TP 238** (February 2026). Both are expected to ship together in **Safari 26**, targeted for **Fall 2026**.

Once Safari 26 ships, `response.body.getReader()` will be reliable in extension service workers and the `disableStreamingOnSafari` guard can be removed.

#### References

- [WebKit Bug — ReadableStream cancel not called in Service Worker](https://webkit.org/blog/16731/release-notes-for-safari-technology-preview-216/) (fixed in Safari TP 216)
- [Safari TP 238 — ReadableStream postMessage transfer support](https://webkit.org/blog/17848/release-notes-for-safari-technology-preview-238/)
- [Safari TP 234 — Readable byte streams, abort/cancel fixes](https://webkit.org/blog/17674/release-notes-for-safari-technology-preview-234/)
- [News from WWDC25 — WebKit in Safari 26 beta](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- [MDN browser-compat-data — ReadableStream postMessage transfer](https://github.com/mdn/browser-compat-data/issues/24643) (Safari marked unsupported)
- [Safari extension service worker cross-origin fetch bug](https://github.com/JamiesWhiteShirt/safari-service-worker-background-bug)
- [Apple Developer Forums — fetch() in Safari extension](https://developer.apple.com/forums/thread/764279)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all AI providers for their powerful APIs
- [KaTeX](https://katex.org) (MIT License) — fast math rendering in summary results
- Special thanks to the open-source community for various libraries used
