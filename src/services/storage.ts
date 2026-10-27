import { AppStateData } from '../types/domain';
import { createSeedState } from '../data/seedData';

const STORAGE_KEY = 'caselink_360_demo_state_v2';

export function loadAppState(): AppStateData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedState();
      saveAppState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as AppStateData;
    if (
      !parsed ||
      !Array.isArray(parsed.cases) ||
      !Array.isArray(parsed.institutions) ||
      !Array.isArray(parsed.evidenceVault) ||
      !Array.isArray(parsed.accessRequests)
    ) {
      const seed = createSeedState();
      saveAppState(seed);
      return seed;
    }
    return parsed;
  } catch {
    return createSeedState();
  }
}

export function saveAppState(state: AppStateData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Graceful fallback if storage quota or sandbox restrictions block write
  }
}

export function resetAppState(): AppStateData {
  const fresh = createSeedState();
  saveAppState(fresh);
  return fresh;
}
