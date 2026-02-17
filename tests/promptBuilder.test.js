import { buildSummarizationPrompt, clampContentForProvider } from '../core/utils/promptBuilder.js';
import { assert, assertEqual } from './testUtils.js';

function run() {
  const longText = 'a'.repeat(70000);
  const openaiClamped = clampContentForProvider(longText, { provider: 'openai' });
  assertEqual(openaiClamped.length, 50000, 'OpenAI clamp should be 50k chars');

  const geminiClamped = clampContentForProvider(longText, { provider: 'gemini' });
  assertEqual(geminiClamped.length, 30000, 'Gemini clamp should be 30k chars');

  const prompt = buildSummarizationPrompt('hello', 'english');
  assert(prompt.includes('under **250 words**'), 'Prompt should include 250 word cap');
  assert(prompt.includes('Length Target'), 'Prompt should include adaptive length section');
  assert(prompt.includes('Page Content:'), 'Prompt should include content section');
  assert(prompt.includes('Preserve mathematical expressions in LaTeX'), 'Prompt should preserve math');

  console.log('promptBuilder tests passed');
}

run();
