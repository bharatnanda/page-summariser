import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  setupMockBrowser();
  const { addHistoryItem, createHistoryItem, isDuplicateHistoryItem } = await import('../core/utils/historyStore.js');

  const item = createHistoryItem('https://example.com', 'Summary text', 'Title', { provider: 'openai', model: 'gpt-4o-mini' });
  assert(item.summary.includes('Summary text'), 'History item should include summary');
  assert(item.contentPreview, 'History item should include preview');
  assertEqual(item.provider, 'openai', 'History item should include provider');
  assertEqual(item.model, 'gpt-4o-mini', 'History item should include model');

  const history = [item];
  assert(
    isDuplicateHistoryItem(history, { ...item }),
    'Duplicate item should be detected'
  );

  const saved1 = await addHistoryItem(item);
  assertEqual(saved1.status, 'saved', 'First save should succeed');

  const saved2 = await addHistoryItem(item);
  assertEqual(saved2.status, 'duplicate', 'Duplicate save should be blocked');

  // Same URL but different provider within dedup window → should NOT be duplicate
  const itemDiffProvider = createHistoryItem('https://example.com', 'Summary text different', 'Title', { provider: 'anthropic', model: 'claude-3-haiku' });
  // Force same timestamp to ensure it's within the dedup window
  itemDiffProvider.timestamp = item.timestamp;
  const diffProviderDup = isDuplicateHistoryItem([item], itemDiffProvider);
  assert(!diffProviderDup, 'Different provider+model should not be treated as duplicate');

  const saved3 = await addHistoryItem(itemDiffProvider);
  assertEqual(saved3.status, 'saved', 'Same URL with different provider should be saved');

  // Same URL, same provider+model, within window → duplicate
  const itemSameProviderWindow = createHistoryItem('https://example.com', 'Some new summary', 'Title', { provider: 'openai', model: 'gpt-4o-mini' });
  itemSameProviderWindow.timestamp = item.timestamp;
  const sameProviderDup = isDuplicateHistoryItem([item], itemSameProviderWindow);
  assert(sameProviderDup, 'Same provider+model within time window should be duplicate');

  resetGlobals();
  console.log('historyStore tests passed');
}

run();
