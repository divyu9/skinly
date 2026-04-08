const createProxy = (path = []) => {
  return new Proxy(() => {}, {
    get: function(target, prop) {
      if (prop === Symbol.toPrimitive) {
        return () => path.join('.');
      }
      if (prop === 'toString' || prop === 'valueOf') {
        return () => path.join('.');
      }
      if (typeof prop === 'string') {
        return createProxy([...path, prop]);
      }
      return Reflect.get(target, prop);
    },
    apply: function(target, thisArg, argumentsList) {
      return path.join('.');
    }
  });
};

export const api = createProxy();
export type Id<T extends string> = string;

