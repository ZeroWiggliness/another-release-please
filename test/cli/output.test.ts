import { outputSuccess, formatError, outputError } from '../../src/cli/output';

describe('formatError', () => {
  test('extracts message and code from error object', () => {
    const err = { message: 'something went wrong', code: 42 };
    expect(formatError(err)).toEqual({ error: true, message: 'something went wrong', code: 42, details: undefined });
  });

  test('defaults code to 1 when not present', () => {
    const err = { message: 'oops' };
    expect(formatError(err).code).toBe(1);
  });

  test('converts non-Error to string message', () => {
    expect(formatError('raw string error').message).toBe('raw string error');
  });

  test('includes details when present', () => {
    const err = { message: 'bad input', code: 400, details: 'field x is required' };
    expect(formatError(err).details).toBe('field x is required');
  });

  test('error flag is always true', () => {
    expect(formatError(new Error('test')).error).toBe(true);
  });
});

describe('outputSuccess', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('logs JSON-serialized result to stdout', () => {
    outputSuccess({ version: '1.2.3' });
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ version: '1.2.3' }));
  });

  test('logs null as JSON null', () => {
    outputSuccess(null);
    expect(consoleSpy).toHaveBeenCalledWith('null');
  });
});

describe('outputError', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((_code?: number | string | null) => { throw new Error('exit'); });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    delete process.env.DEBUG;
  });

  test('writes JSON error to stderr and exits', () => {
    const err = { message: 'fatal error', code: 2 };

    expect(() => outputError(err)).toThrow('exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(JSON.stringify({ error: true, message: 'fatal error', code: 2, details: undefined }));
    expect(processExitSpy).toHaveBeenCalledWith(2);
  });

  test('exits with code 1 for errors without a code', () => {
    const err = { message: 'unknown error' };

    expect(() => outputError(err)).toThrow('exit');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('writes stack to stderr when DEBUG is set', () => {
    process.env.DEBUG = 'true';
    const err = { message: 'debug error', code: 1, stack: 'Error: debug error\n    at line 1' };

    expect(() => outputError(err)).toThrow('exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(err.stack);
  });

  test('does not write stack when DEBUG is not set', () => {
    const err = { message: 'no stack', code: 1, stack: 'Error: no stack' };

    expect(() => outputError(err)).toThrow('exit');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // only the JSON error line
  });
});
