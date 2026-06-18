export async function runWithStartContext<T>(_: unknown, fn: () => T | Promise<T>) {
  return fn();
}

export function getStartContext<TThrow extends boolean = false>(opts?: {
  throwIfNotFound?: TThrow;
}): TThrow extends false ? undefined : unknown {
  if (opts?.throwIfNotFound) {
    throw new Error("No Start context available in the browser.");
  }
  return undefined as TThrow extends false ? undefined : unknown;
}
