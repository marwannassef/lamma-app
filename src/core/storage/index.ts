import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

const mmkv = createMMKV({ id: 'lamma' });

/** Key-value storage adapter. Everything persisted goes through here. */
export const storage: StateStorage & { clear(): void } = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
  clear: () => mmkv.clearAll(),
};
