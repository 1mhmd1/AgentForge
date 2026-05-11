import { ApiKeysService } from '../src/modules/apikeys/apikeys.service';

/**
 * The prefix derivation must come from the raw key (not from process.env).
 * Otherwise a key minted in test mode and used in production (or vice versa)
 * would lookup against the wrong DB row and 401 the legitimate user.
 */
describe('ApiKeysService.derivePrefix', () => {
  // Reach into the private method via a thin shim — same trick `__test`
  // exports use elsewhere, kept inline here to avoid leaking it from prod.
  const svc = new ApiKeysService({} as any) as any;

  it('parses live env from the raw key', () => {
    expect(svc.derivePrefix('agf_live_AbCdEfGh_more_chars')).toBe('agf_live_AbCdEfGh');
  });
  it('parses test env from the raw key', () => {
    expect(svc.derivePrefix('agf_test_12345678zzzzzz')).toBe('agf_test_12345678');
  });
  it('rejects malformed prefixes', () => {
    expect(svc.derivePrefix('not-a-key')).toBeNull();
    expect(svc.derivePrefix('agf_dev_AbCdEfGh')).toBeNull(); // unknown env
    expect(svc.derivePrefix('agf_live_short')).toBeNull(); // < 8 random chars
  });
});
