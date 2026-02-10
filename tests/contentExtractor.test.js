import { assertEqual } from './testUtils.js';
import { extractPageData } from '../core/utils/contentExtractor.js';

function setMockDom({ selectionText = "", bodyText = "", docText = "", title = "" }) {
  globalThis.window = {
    getSelection: () => ({
      toString: () => selectionText
    })
  };
  globalThis.document = {
    title,
    querySelector: () => null,
    body: { innerText: bodyText, textContent: bodyText },
    documentElement: { innerText: docText, textContent: docText }
  };
}

// Selection overrides
setMockDom({ selectionText: "Selected text", bodyText: "Body text", docText: "Doc text", title: "Title" });
let result = extractPageData(false);
assertEqual(result.text, "Selected text", "selection overrides extraction");

// Basic innerText path
setMockDom({ selectionText: "", bodyText: "Body text", docText: "Doc text", title: "Title" });
result = extractPageData(false);
assertEqual(result.text, "Body text", "innerText used when extraction engine disabled");

// Cleanup
delete globalThis.window;
delete globalThis.document;

console.log('contentExtractor tests passed');
