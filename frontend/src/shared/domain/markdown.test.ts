import { describe, expect, it } from 'vitest';
import { marked } from 'marked';

describe('markdown rendering', () => {
  it('renders bold text', () => {
    const result = marked.parse('**hello**');
    expect(result).toContain('<strong>hello</strong>');
  });

  it('renders inline code', () => {
    const result = marked.parse('`code`');
    expect(result).toContain('<code>code</code>');
  });
});
