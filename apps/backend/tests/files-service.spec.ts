import { __test } from '../src/modules/files/files.service';

describe('FilesService.sanitizeFilename', () => {
  const { sanitizeFilename } = __test;

  it.each([
    ['../../../etc/passwd', 'passwd'],
    ['..\\..\\..\\Windows\\System32\\cmd.exe', 'cmd.exe'],
    ['my report.pdf', 'my_report.pdf'],
    ['', 'upload'],
    ['.bashrc', '_bashrc'],
    // Path components are stripped first; leading dots get escaped, leaving
    // a single underscore. Still safe (no traversal) — that's what matters.
    ['../', '_'],
    ['name with spaces and !@#$%^&*().txt', 'name_with_spaces_and_.txt'],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });

  it('never returns a name containing path separators', () => {
    for (const input of [
      '../../etc/passwd',
      'foo/bar.txt',
      'C:\\Windows\\evil.exe',
      '\\\\unc\\path\\file.bin',
    ]) {
      const out = sanitizeFilename(input);
      expect(out).not.toMatch(/[\\/]/);
    }
  });

  it('truncates extremely long filenames', () => {
    const long = 'a'.repeat(500) + '.txt';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(200);
  });
});

describe('FilesService.isUtf8', () => {
  const { isUtf8 } = __test;

  it('accepts plain ASCII', () => {
    expect(isUtf8(Buffer.from('hello world'))).toBe(true);
  });

  it('accepts unicode', () => {
    expect(isUtf8(Buffer.from('naïve café — 中文'))).toBe(true);
  });

  it('rejects an invalid UTF-8 byte sequence (lone continuation byte)', () => {
    expect(isUtf8(Buffer.from([0xff, 0xfe, 0xfd]))).toBe(false);
  });
});
