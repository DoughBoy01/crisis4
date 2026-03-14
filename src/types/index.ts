export type Signal = 'BUY' | 'HOLD' | 'WATCH' | 'URGENT';

export type SectorId = 'agricultural' | 'freight' | 'food' | 'energy';

export interface PricePoint {
  timestamp: string;
  value: number;
}

export interface MarketItem {
  id: string;
  name: string;
  shortName: string;
  price: number;
  currency: string;
  unit: string;
  change24h: number;
  changePercent24h: number;
  changeWeekly: number;
  changeWeeklyPercent: number;
  signal: Signal;
  rationale: string;
  source: string;
  sourceUrl: string;
  lastUpdated: string;
  history: PricePoint[];
  category: MarketCategory;
  relevantSectors: SectorId[];
}

export type MarketCategory = 'energy' | 'freight' | 'fertilizer' | 'agricultural' | 'metals';

export interface MorningAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  body: string;
  source: string;
  affectedMarkets: string[];
  timestamp: string;
  geopoliticalContext?: string;
}

export interface ROIPotential {
  savingAmount: number;
  tonnage: number;
  priceMove: number;
  unit: string;
  deadline: string;
  annualSubscriptionCost: number;
  multiplier: number;
}

export interface ActionItem {
  id: string;
  signal: Signal;
  title: string;
  detail: string;
  market: string;
  evidence: string;
  source: string;
  deadline?: string;
  roi?: ROIPotential;
  relevantSectors: SectorId[];
}

export interface OvernightStat {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

export type ConflictRiskLevel = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW';

export interface ConflictZone {
  id: string;
  region: string;
  subRegion?: string;
  riskLevel: ConflictRiskLevel;
  affectedCommodities: string[];
  affectedRoutes: string[];
  latestHeadline: string;
  headlineSource: string;
  headlineLink: string;
  lastUpdated: string;
  evidenceCount: number;
  supplyImpact: string;
}

export interface SupplyExposureItem {
  market: string;
  category: MarketCategory;
  exposureScore: number;
  conflictProximity: number;
  supplyConcentration: number;
  ukImportDependency: number;
  topRisk: string;
  mitigationNote: string;
  linkedZones: string[];
}

export type PlaybookTrigger = 'PRICE_SPIKE' | 'SUPPLY_DISRUPTION' | 'GEOPOLITICAL' | 'FX_STRESS' | 'FREIGHT_SURGE';

export interface PlaybookStep {
  order: number;
  action: string;
  owner: string;
  deadline: string;
}

export interface ContingencyScenario {
  id: string;
  trigger: PlaybookTrigger;
  title: string;
  condition: string;
  severity: 'critical' | 'high' | 'medium';
  active: boolean;
  activationEvidence?: string;
  steps: PlaybookStep[];
  affectedMarkets: string[];
  lastReviewed: string;
}
