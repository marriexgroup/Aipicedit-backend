function concurrencyLimiter(maxConcurrency) {
    let running = 0;
    const queue = [];
  
    const runNext = () => {
      if (running >= maxConcurrency || queue.length === 0) return;
      running++;
      const { fn, resolve, reject } = queue.shift();
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          running--;
          runNext();
        });
    };
  
    return function limit(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        runNext();
      });
    };
  }
  
  module.exports = concurrencyLimiter;
  