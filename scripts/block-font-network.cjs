// Build acceptance guard. Every Next worker inherits NODE_OPTIONS.
const dns = process.getBuiltinModule('node:dns');
const blocked = (hostname) => /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(hostname);
const lookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (blocked(hostname)) {
    const done = typeof options === 'function' ? options : callback;
    return process.nextTick(
      done,
      Object.assign(new Error('External font network blocked for build acceptance'), {
        code: 'ENETUNREACH',
      }),
    );
  }
  return lookup.apply(this, arguments);
};
const fetchOriginal = globalThis.fetch;
globalThis.fetch = function (input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (blocked(url.hostname))
    return Promise.reject(new Error('External font network blocked for build acceptance'));
  return fetchOriginal(input, options);
};
