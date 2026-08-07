/** localStorage key for TrustModal submission persistence */
const STORAGE_KEY = '1b_trust_submission';
const CURRENT_VERSION = 1;

export type TrustServiceId = 'registration' | 'hosting';

export interface TrustFormData {
  name: string;
  phone: string;
  company: string;
  serviceTypes: TrustServiceId[];
}

/** Shape of the persisted submission state */
export interface TrustSubmissionState {
  /** Schema version for future migration support */
  version: number;
  /** Whether the user has successfully submitted */
  submitted: boolean;
  /** Last submitted form data (for pre-filling on refill) */
  formData: TrustFormData;
  /** Timestamp when state was saved */
  savedAt: number;
}

const DEFAULT_FORM_DATA: TrustFormData = {
  name: '',
  phone: '',
  company: '',
  serviceTypes: [],
};

/**
 * Load persisted submission state from localStorage.
 * Returns null if no valid state exists (missing, corrupt, or version mismatch).
 */
export const loadSubmissionState = (): TrustSubmissionState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CURRENT_VERSION) {
      return null;
    }

    const formData = parsed.formData ?? {};
    const storedTypes = Array.isArray(formData.serviceTypes)
      ? formData.serviceTypes
      : Array.isArray(formData.services)
        ? formData.services.map((type: string) => type === 'management' ? 'hosting' : type)
        : [];
    const serviceTypes = storedTypes.filter(
      (type: string): type is TrustServiceId => type === 'registration' || type === 'hosting',
    );

    return {
      ...parsed,
      formData: {
        ...DEFAULT_FORM_DATA,
        ...formData,
        serviceTypes,
      },
    } as TrustSubmissionState;
  } catch {
    return null;
  }
};

/**
 * Save submission state to localStorage.
 * Silently handles quota exceeded errors.
 */
export const saveSubmissionState = (submitted: boolean, formData: TrustFormData): void => {
  try {
    const toSave: TrustSubmissionState = {
      version: CURRENT_VERSION,
      submitted,
      formData,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Quota exceeded or other storage errors — fail silently
  }
};

/**
 * Clear persisted submission state from localStorage.
 */
export const clearSubmissionState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};

export { DEFAULT_FORM_DATA };
