# Page Summarizer User Guide

Welcome to Page Summarizer, a powerful Chrome extension that helps you quickly understand the main points of any web page using artificial intelligence.

## Getting Started

### Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`, for Edge navigate to `edge://extensions`
3. Look for "Developer mode" toggle on the screen and enable it
4. Click "Load unpacked" and select the extension directory
5. Pin the extension to your toolbar for easy access

### First-Time Setup
1. Click the Page Summarizer icon in your Chrome toolbar
2. Click "Settings" to configure your AI provider
3. Enter your API key (not required for Ollama)
4. Select your preferred settings

## How to Use Page Summarizer

### Method 1: Using the Popup (Recommended)
1. Navigate to any web page you want to summarize
2. Click the Page Summarizer icon in your Chrome toolbar
3. Click the "Summarize This Page" button
4. Wait for the AI to generate the summary (usually 10-30 seconds)
5. View your summary in a new tab

### Method 2: Context Menu
1. Right-click anywhere on a web page
2. Select "Summarize this page" from the context menu
3. Wait for the summary to be generated
4. View your summary in a new tab

## Choosing Your AI Provider

Page Summarizer supports multiple AI providers. Here's how to choose the best one for you:

### OpenAI (GPT)
- **Best for**: High-quality summaries with advanced language understanding
- **Requirements**: API key from OpenAI
- **Cost**: Pay-per-use pricing
- **Setup**: Get an API key from [OpenAI Platform](https://platform.openai.com/)

### Google Gemini
- **Best for**: Google AI technology with good performance
- **Requirements**: API key from Google AI Studio
- **Cost**: Free tier available with paid options
- **Setup**: Get an API key from [Google AI Studio](https://makersuite.google.com/)

### Azure OpenAI
- **Best for**: Enterprise users or those with Azure accounts
- **Requirements**: Azure subscription and deployed model
- **Cost**: Based on Azure pricing
- **Setup**: Requires Azure configuration

### Ollama (Local AI)
- **Best for**: Privacy-focused users who want local processing
- **Requirements**: Ollama installed on your computer
- **Cost**: Completely free
- **Setup**: 
  1. Download and install [Ollama](https://ollama.com/)
  2. Run `ollama run gemma3n` in your terminal to download the model

## Managing Your Settings

### Accessing Settings
1. Click the Page Summarizer icon in your Chrome toolbar
2. Click the "Settings" button (gear icon)

### Provider Configuration
- **Provider**: Select your preferred AI service
- **API Key**: Enter your API key (leave blank for Ollama)
- **Base URL**: Custom endpoint (usually not needed)
- **Model**: Specify which AI model to use
- **Temperature**: Adjust creativity (0 = precise, 1 = creative)

### Language Preferences
Choose the language for your summaries:
- English (default)
- Hindi
- French
- German
- Spanish

### Domain Blacklist
Prevent summarization on specific sites:
- Add domains like `*.mail.google.com` to block email summarization
- Separate multiple domains with semicolons
- The extension includes a comprehensive list of domains blacklisted by default for your security and privacy (see the README for the full list)

## Using the History Feature

### Viewing History
1. Click the Page Summarizer icon in your Chrome toolbar
2. Click "View History" to see all your summaries

### History Features
- **Table View**: See all summaries in an organized table
- **Click to View**: Click any row to see the full summary
- **Delete Items**: Remove individual summaries with the trash icon
- **Clear All**: Remove all history with the "Clear History" button

### History Benefits
- Keep track of what you've summarized
- Revisit important summaries
- Find previous research quickly

## Working with Summaries

### Summary Actions
When viewing a summary, you can:
- **Copy**: Click the copy button to save to clipboard
- **Download**: Save as a Markdown (.md) file
- **Save**: Add to your history (if accessed directly)
- **View History**: Return to the history page

### Summary Features
- **Formatted Text**: Clean, readable formatting
- **Key Points**: Bullet points for easy scanning
- **Source Information**: Original page URL included
- **Responsive Design**: Works on mobile and desktop

### Privacy and Security

### Your Data
- **Local Processing**: All processing happens in your browser
- **No Server Storage**: We don't store your data on our servers
- **Direct API Connection**: Content goes directly to your chosen AI provider
- **Domain Protection**: Sensitive domains like email services, banking sites, and government pages are blacklisted by default

For complete information about how we handle your data, please read our [Privacy Policy](PRIVACY_POLICY.md).

### API Keys
- **Secure Storage**: Keys are stored in Chrome's secure storage
- **No Sharing**: We never see your API keys
- **Provider Terms**: Your usage is subject to your AI provider's terms

### Content Handling
- **Temporary Processing**: Content is only used for summarization
- **No Retention**: Content is not stored after processing
- **Your Responsibility**: Ensure you have rights to summarize content

## Troubleshooting Common Issues

### "API Key Missing" Error
1. Go to Settings
2. Enter your API key for the selected provider
3. Save your settings

### "Unable to Connect to Ollama" Error
1. Ensure Ollama is installed
2. Start Ollama (run `ollama serve` in terminal)
3. Try the summarization again

### "Invalid API Key" Error
1. Double-check your API key
2. Ensure your key has proper permissions
3. Verify you're using the correct provider settings

### "No Content Found" Error
1. Refresh the page
2. Try a different web page
3. Some pages may not be compatible with content extraction

### Slow Summaries
- **Internet Connection**: Check your connection speed
- **AI Provider**: Some providers are faster than others
- **Content Length**: Very long pages take more time to process

## Tips for Best Results

### Getting Better Summaries
1. **Use on Article Pages**: News articles and blog posts work best
2. **Avoid Homepage**: Homepages often have too much varied content
3. **Check Language**: Ensure content matches your summary language
4. **Review Settings**: Adjust temperature for preferred style

### Managing Costs
1. **Use Caching**: The extension caches summaries for 30 minutes
2. **Choose Providers**: Ollama is free, others have usage costs
3. **Monitor Usage**: Keep track of your API provider usage

### Privacy Tips
1. **Use Ollama**: For maximum privacy, use local processing
2. **Blacklist Domains**: Prevent summarizing sensitive sites (the extension already includes a comprehensive default list)
3. **Clear History**: Regularly clean up your summary history

## Frequently Asked Questions

### Is my data safe?
Yes, all processing happens locally in your browser. Content is sent directly to your chosen AI provider with no intermediate servers.

### Do I need to pay for API usage?
It depends on your provider:
- **Ollama**: Completely free
- **OpenAI/Gemini**: Pay-per-use
- **Azure OpenAI**: Based on your Azure plan

### Can I use this offline?
Only with Ollama, which runs locally on your computer.

### How long are summaries cached?
Summaries are cached for 30 minutes to reduce API usage.

### Can I summarize any web page?
Most pages work well, but some complex sites or pages with little text may not produce good results.

### How many summaries are stored in history?
The extension keeps your 50 most recent summaries.

## Getting Support

If you need help:
1. Check this user guide for solutions
2. Look at browser console errors (Ctrl+Shift+J)
3. Verify your settings are correct
4. Ensure your API key is valid and active

For bugs or feature requests, please submit an issue on the project repository.
