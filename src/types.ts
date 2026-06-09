export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  showPhEc?: boolean;
}

export type SystemType = 'Indoor_Soil' | 'Outdoor_Soil' | 'Outdoor_Ground' | 'Hydro_Water' | 'Other';

export function getSystemTypeLabel(type: SystemType): string {
  switch (type) {
    case 'Indoor_Soil':
      return '室内プランター (土耕)';
    case 'Outdoor_Soil':
      return '室外プランター (土耕)';
    case 'Outdoor_Ground':
      return 'お庭の菜園・地植え (プランター)';
    case 'Hydro_Water':
      return '水耕プランター';
    case 'Other':
      return 'その他';
    default:
      return '栽培用設備';
  }
}

export function isSoilSystem(type: SystemType): boolean {
  return type === 'Indoor_Soil' || type === 'Outdoor_Soil' || type === 'Outdoor_Ground';
}

export interface System {
  id: string;
  userId: string;
  name: string;
  type: SystemType;
  description: string;
  suspended?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlantStage = 'seedling' | 'vegetative' | 'flowering' | 'harvest' | 'finished';

export interface Plant {
  id: string;
  systemId: string;
  userId: string; // Owner ID
  name: string;
  variety: string;
  stage: PlantStage;
  sowingDate: string;
  expectedHarvestDate: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  fertilizerBrand?: string;       // Default fertilizer type
  fertilizerAmountMl?: number;    // Default amount
  fertilizerDilutionRate?: number;// Default dilution rate (e.g. 500, 1000)
}

export type MemberRole = 'owner' | 'member';

export interface SystemMember {
  id: string;
  systemId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface GrowLog {
  id: string;
  plantId: string;
  postedBy: string; // User ID
  postedByName?: string; // Hydrated
  ph: number | null;
  ec: number | null;
  waterTemp: number | null;
  note: string;
  loggedAt: string;
  watered?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  appliedFertilizer?: boolean;      // Whether fertilizer was applied in this event
  fertilizerBrand?: string;         // Applied fertilizer brand
  fertilizerAmountMl?: number;      // Applied amount (ml)
  fertilizerDilutionRate?: number;  // Applied dilution rate
}

export interface PlantPhoto {
  id: string;
  plantId: string;
  growLogId: string | null;
  postedBy: string;
  storageKey: string; // Data URI (Base64) or static placeholder
  caption: string;
  takenAt: string;
}

export interface NutrientLog {
  id: string;
  plantId: string;
  postedBy: string;
  postedByName?: string; // Hydrated
  brand: string; // e.g. "ハイポニカ", "OATハウス", "微粉ハイポネックス", "その他"
  dilutionRate: number; // e.g. 500 or 1000
  amountMl: number;
  note: string;
  appliedAt: string;
}

export interface ChatMessage {
  id: string;
  plantId: string;
  postedBy: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type ProposalType = 'watering' | 'nutrient' | 'pruning' | 'weeding_aeration' | 'water_change' | 'ph_check' | 'harvest';
export type ProposalStatus = 'pending' | 'approved' | 'dismissed' | 'completed';

export interface ScheduleProposal {
  id: string;
  plantId: string;
  userId: string; // User who gets the proposal
  type: ProposalType;
  proposedDate: string;
  note: string;
  status: ProposalStatus;
  createdAt: string;
}

// Responses and payloads
export interface DashboardStats {
  todayTasks: ScheduleProposal[];
  pendingCount: number;
}

export interface HarvestPrediction {
  id: string;
  plantId: string;
  calculatedHarvestDate: string;
  reason: string;
  updatedAt: string;
}

