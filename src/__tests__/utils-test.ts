import { getHost } from '../utils';

describe('Utils', () => {
  describe('getHost', () => {
    it('should extract hostname from valid URLs', () => {
      expect(getHost('https://www.example.com')).toBe('www.example.com');
      expect(getHost('http://example.com/path')).toBe('example.com');
      expect(getHost('https://subdomain.example.com/path?query=123')).toBe('subdomain.example.com');
    });

    it('should return "other" for invalid URLs', () => {
      expect(getHost('invalid-url')).toBe('other');
      expect(getHost('')).toBe('other');
    });
  });
});