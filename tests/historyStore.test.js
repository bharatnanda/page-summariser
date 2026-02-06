import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  setupMockBrowser();
  const { addHistoryItem, createHistoryItem, isDuplicateHistoryItem } = await import('../core/utils/historyStore.js');

  const item = createHistoryItem('https://example.com', 'Summary text', 'Title');
  assert(item.summary.includes('Summary text'), 'History item should include summary');
  assert(item.contentPreview, 'History item should include preview');

  const history = [item];
  assert(
    isDuplicateHistoryItem(history, { ...item }),
    'Duplicate item should be detected'
  );

  const saved1 = await addHistoryItem(item);
  assertEqual(saved1.status, 'saved', 'First save should succeed');

  const saved2 = await addHistoryItem(item);
  assertEqual(saved2.status, 'duplicate', 'Duplicate save should be blocked');

  resetGlobals();
  console.log('historyStore tests passed');
}

run();
