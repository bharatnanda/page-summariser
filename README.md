# Page Summarizer Chrome Extension

A powerful Chrome extension that allows users to summarize web pages using various AI providers including OpenAI, Google Gemini, Azure OpenAI, and Ollama.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Supported AI Providers](#supported-ai-providers)
- [Usage](#usage)
- [Configuration](#configuration)
- [Privacy](#privacy)
- [Development](#development)

## Features

- **Multi-Provider AI Support**: Works with OpenAI, Google Gemini, Azure OpenAI, and Ollama
- **Content Extraction**: Automatically extracts text content from web pages
- **Smart Summarization**: Generates concise, well-structured summaries
- **Streaming Summaries**: Watch summaries appear in real time for supported providers
- **History Tracking**: Keeps track of your previous summaries
- **Caching**: Caches summaries for 30 minutes to reduce API usage
- **Domain Blacklisting**: Prevents summarization on restricted domains with a comprehensive default list for security and privacy
- **Multi-Language Support**: Summarize content in multiple languages
- **Responsive Design**: Works on all device sizes

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`, for Edge navigate to `edge://extensions`
3. Look for "Developer mode" toggle on the screen and enable it
4. Click "Load unpacked" and select the extension directory
5. Pin the extension to your toolbar for easy access

## Supported AI Providers

### OpenAI
- **API Key Required**: Yes
- **Default Model**: gpt-4o-mini
- **Base URL**: https://api.openai.com/v1 (also accepts full endpoint URLs)

### Google Gemini
- **API Key Required**: Yes
- **Default Model**: gemini-2.5-flash
- **Base URL**: https://generativelanguage.googleapis.com/v1beta

### Azure OpenAI
- **API Key Required**: Yes
- **Custom Configuration**: Base URL, Deployment Name, and API Version required
- **Model**: Configurable

### Ollama (Local)
- **API Key Required**: No
- **Default Model**: gemma3n
- **Base URL**: http://localhost:11434
- **Note**: Requires Ollama to be installed and running locally. If you are calling from a browser extension, set `export OLLAMA_ORIGINS="*"` before starting Ollama.

## Usage

### Summarizing a Page
1. Navigate to any web page you want to summarize
2. Click the Page Summarizer icon in your Chrome toolbar
3. Click "Summarize This Page"
4. View the generated summary in a new tab


### Viewing History
1. Click the Page Summarizer icon in your Chrome toolbar
2. Click "View History" to see your previous summaries
3. Click any row to view the full summary
4. Use the delete button to remove individual summaries

### Managing Settings
1. Click the Page Summarizer icon in your Chrome toolbar
2. Click "Settings" to configure the extension
3. Select your preferred AI provider and configure settings

## Configuration

### Provider Settings
- **Provider**: Select from OpenAI, Ollama, Gemini, or Azure OpenAI
- **API Key**: Your API key for the selected provider (not required for Ollama)
- **Base URL**: Custom endpoint URL (primarily for Azure OpenAI and Ollama)
- **Model Name**: Specify which model to use
- **Provider-Scoped Storage**: Each provider keeps its own saved credentials and model settings

### Provider-Specific Settings
- **Azure OpenAI**: Requires Deployment Name and API Version
- **Ollama**: Can run entirely locally without an API key

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
- See [Default Blacklisted Domains](#default-blacklisted-domains) for the comprehensive list of domains blacklisted by default

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
- Settings are synchronized across your Chrome devices
- No data is shared with third parties

### API Keys
- API keys are stored securely in Chrome's storage
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

### Multi-Platform Builds

The extension code lives in `core/` and is built per platform using the manifest in `platforms/<platform>/manifest.json`.

Build outputs go to `dist/<platform>/`.

#### Build for Chrome

```
node build/build.js chrome
```

Load `dist/chrome/` as an unpacked extension in Chrome/Edge.

#### Build for Firefox

```
node build/build.js firefox
```

Load `dist/firefox/` as a temporary add-on in `about:debugging`, or zip the folder for AMO submission.

#### Build for Safari

```
node build/build.js safari
```

Then convert the WebExtension bundle to a Safari App:

```
safari-web-extension-converter dist/safari --project-location safari-app
```

Open the generated Xcode project in `safari-app/`, enable the extension, and build/run.

#### Platform Overrides

If you need platform-specific changes, place files in:

```
platforms/<platform>/overrides/
```

Those files override `core/` during the build.

### Adding New Providers

1. Create a new client in `utils/api/` (e.g., `newProviderClient.js`)
2. Implement the required functions:
   - `callNewProvider(prompt, settings)`
3. Update `utils/apiClient.js` to include the new provider
4. Add provider-specific settings to `options.html` and `options.js`
5. Update the provider selection in `options.html`

### Customization

#### Styling
- Modify `assets/styles.css` for global styles
- Update individual HTML files for page-specific styles

#### Prompt Engineering
- Modify `utils/promptBuilder.js` to change summarization behavior
- Adjust rules for content inclusion/exclusion

#### Error Handling
- Customize error messages in provider-specific clients
- Modify notification behavior in individual JavaScript files

## Troubleshooting

### Common Issues

#### "API Key Missing" Error
- Ensure you've entered your API key in Settings
- Verify the API key is correct and active

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

### Getting Help
If you encounter issues not covered in this documentation:
1. Check the browser console for error messages
2. Verify your API provider settings
3. Ensure your API key is valid and has sufficient credits

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
- Special thanks to the open-source community for various libraries used
