export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export type SystemType = 'Soil_Planter' | 'Backyard_Field' | 'DWC' | 'NFT' | 'Kratky' | 'Ebb_Flow' | 'Other';

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

