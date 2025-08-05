let _instance: InlineCompletionDebouncer | null = null;

export class InlineCompletionDebouncer {
  public static getInstance(logger: { info(...args: any): void }) {
    if (!_instance) {
      _instance = new InlineCompletionDebouncer(logger);
    }

    return _instance;
  }

  private timeoutId?: NodeJS.Timeout;

  constructor(private logger: { info(...args: any): void }) {
    this.logger.info(`BNCoder4: Init Debouncer`);
  }

  /**
   * Debounce a function execution to ensure it is not executed multiple times within a specified delay.
   * @param callback The function to be debounced.
   * @param debounceDelay The delay in milliseconds after which the callback will be called again. If no value is provided, a default debounce delay of 500ms will be used.
   * @returns A Promise that resolves when the callback is executed and completed, or rejects if an error occurs during execution.
   */
  debounce<T>(callback: () => Promise<T>, debounceDelay: number): Promise<T> {
    let id = Math.floor(Math.random() * 10 ** 9);
    const log = (...args: any) => {
      this.logger.info(`Debouncer [${id}]: `, ...args);
    };
    log(`debounce called`);
    return new Promise<T>((resolve, reject) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        log(`Debounced`);
      } else {
        log(`BNCoder4 Debouncer: PASSED THROUGH! ${this.timeoutId}`);
      }

      this.timeoutId = setTimeout(() => {
        return callback().then(resolve).catch(reject);
      }, debounceDelay);
    });
  }
}
