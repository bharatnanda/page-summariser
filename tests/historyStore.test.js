import { assert, assertEqual, resetGlobals, setupMockBrowser } from './testUtils.js';

async function run() {
  setupMockBrowser();
  const { addHistoryItem, createHistoryItem, isDuplicateHistoryItem } = await import('../core/utils/historyStore.js');

  const item = createHistoryItem(
    'https://example.com',
    'Summary text with math $a_b + c$',
    'Title',
    { provider: 'openai', model: 'gpt-4o-mini' },
    'summary_1'
  );
  assert(item.summaryId === 'summary_1', 'History item should include summaryId');
  assert(item.summaryHash, 'History item should include summary hash');
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

  resetGlobals();
  console.log('historyStore tests passed');
}

run();
