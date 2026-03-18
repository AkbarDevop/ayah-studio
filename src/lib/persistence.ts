const STORAGE_KEY = "ayah-studio-project";

export interface PersistedProject {
  selectedSurahNumber: number | null;
  translationEdition: string;
  subtitleStyle: string;
  aspectRatio: string;
  defaultDuration: number;
  selectedReciter: string;
  savedAt: number;
}

export function saveProject(state: PersistedProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function loadProject(): PersistedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedProject;
  } catch {
    return null;
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
