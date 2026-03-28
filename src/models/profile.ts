export interface UserProfile {
  id: string;
  heightCm: number;
  weightKg: number;
  ageYears: number;
  sex: 'male' | 'female';
}

export interface BmrResult {
  bmr: number;
  formula: 'mifflin-st-jeor';
  profile: UserProfile;
}

const profiles = new Map<string, UserProfile>();

export function getProfile(id: string): UserProfile | undefined {
  return profiles.get(id);
}

export function setProfile(profile: UserProfile): void {
  profiles.set(profile.id, profile);
}
