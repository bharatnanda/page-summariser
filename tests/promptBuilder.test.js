import { buildSummarizationPrompt, clampContentForProvider } from '../core/utils/promptBuilder.js';
import { assert, assertEqual } from './testUtils.js';

function run() {
  const longText = 'a'.repeat(70000);
  const defaultClamped = clampContentForProvider(longText, {});
  assertEqual(defaultClamped.length, 60000, 'Default clamp should be 60k chars');

  const customClamped = clampContentForProvider(longText, { maxContentChars: 42000 });
  assertEqual(customClamped.length, 42000, 'Custom clamp should use maxContentChars');

  const prompt = buildSummarizationPrompt('hello', 'english');
  assert(prompt.includes('under **250 words**'), 'Prompt should include 250 word cap');
  assert(prompt.includes('Length Target'), 'Prompt should include adaptive length section');
  assert(prompt.includes('Page Content:'), 'Prompt should include content section');
  assert(prompt.includes('Preserve mathematical expressions in LaTeX'), 'Prompt should preserve math');

  console.log('promptBuilder tests passed');
}

run();
