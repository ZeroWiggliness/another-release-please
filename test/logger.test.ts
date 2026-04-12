import * as logger from '../src/logger';

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    logger.setDebug(false);
  });

  it('forwards info to stdout', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => { });
    logger.info('hello', 'world');
    expect(spy).toHaveBeenCalledWith('hello', 'world');
  });

  it('forwards warn to console.warn', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    logger.warn('watch out');
    expect(spy).toHaveBeenCalledWith('watch out');
  });

  it('forwards error to console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
    logger.error('oops');
    expect(spy).toHaveBeenCalledWith('oops');
  });

  it('only prints debug when enabled', () => {
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });
    logger.debug('not printed');
    expect(spy).not.toHaveBeenCalled();
    logger.setDebug(true);
    logger.debug('printed');
    expect(spy).toHaveBeenCalledWith('printed');
  });
});
