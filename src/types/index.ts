export type Signal = 'BUY' | 'HOLD' | 'WATCH' | 'URGENT';

export type SectorId = 'food_importer' | 'chemicals' | 'freight_3pl' | 'construction' | 'financial';

export interface PricePoint {
  timestamp: string;
  value: number;
}

export interface PercentileContext {
  rank: number;
  label: string;
  color: string;
  bg: string;
  median: number;
  p25: number;
  p75: number;
  dataSource: string;
}

export interface SeasonalContext {
  seasonalIndex: number;
  pressureLabel: string;
  notes: string | null;
  color: string;
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
  percentileContext?: PercentileContext;
  seasonalContext?: SeasonalContext;
}

export type MarketCategory = 'energy' | 'freight' | 'fertilizer' | 'agricultural' | 'metals' | 'fx';

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

export interface ConflictIntensity {
  vsBaseline: string;
  label: string;
  color: string;
  historicalImpactPct: number | null;
  topComparableEvent: string | null;
}

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
  intensity?: ConflictIntensity;
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
