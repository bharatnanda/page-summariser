import { isDomainBlacklisted } from '../core/utils/domainBlacklist.js';

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

function run() {
  const list = [
    '*.mail.google.com',
    'mail.google.com',
    '*.bank.in',
    '*.gov.*',
    '*.example.com'
  ].join(';');

  assertEqual(isDomainBlacklisted(list, 'https://mail.google.com'), true, 'Exact domain should match');
  assertEqual(isDomainBlacklisted(list, 'https://foo.mail.google.com'), true, 'Wildcard subdomain should match');
  assertEqual(isDomainBlacklisted(list, 'https://google.com'), false, 'Unrelated domain should not match');
  assertEqual(isDomainBlacklisted(list, 'https://www.icici.bank.in'), true, 'Wildcard .bank.in should match subdomain');
  assertEqual(isDomainBlacklisted(list, 'https://bank.in'), false, 'Wildcard should not match apex without explicit entry');
  assertEqual(isDomainBlacklisted(list, 'https://agency.gov.uk'), true, 'Complex wildcard should match');
  assertEqual(isDomainBlacklisted(list, 'https://example.com'), true, 'Wildcard should include apex domain');
  assertEqual(isDomainBlacklisted(list, 'https://sub.example.com'), true, 'Wildcard should match subdomain');

  console.log('domainBlacklist tests passed');
}

run();
