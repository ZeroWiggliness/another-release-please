describe('CLI JSON output', () => {
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;
  let originalExit: any;

  beforeAll(() => {
    originalExit = process.exit;
    process.exit = jest.fn((code?: number) => { throw new Error(`EXIT:${code}`); }) as any;
  });

  afterAll(() => {
    process.exit = originalExit;
  });

  beforeEach(() => {
    jest.resetModules();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    (process.exit as unknown as jest.Mock).mockClear();
  });

  it('prints JSON result to stdout on success', async () => {
    const { outputSuccess } = await import('../../src/cli/output');

    const fakeResult = { nextVersion: '9.9.9' };

    outputSuccess(fakeResult);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(fakeResult));
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('formats errors as JSON correctly', async () => {
    const { formatError } = await import('../../src/cli/output');

    const parsed = formatError(new Error('boom'));

    expect(parsed).toHaveProperty('error', true);
    expect(parsed).toHaveProperty('message', 'boom');
    expect(parsed).toHaveProperty('code', 1);
  });
});
