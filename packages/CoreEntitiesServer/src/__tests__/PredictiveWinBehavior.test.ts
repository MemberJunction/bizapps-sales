import { describe, expect, it } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { ComputePredictiveWinRiskBand, DealEntityServer } from '../DealEntityServer.js';

describe('ComputePredictiveWinRiskBand', () => {
    it('returns null for null, undefined, or NaN', () => {
        expect(ComputePredictiveWinRiskBand(null)).toBeNull();
        expect(ComputePredictiveWinRiskBand(undefined)).toBeNull();
        expect(ComputePredictiveWinRiskBand(NaN)).toBeNull();
    });

    it('classifies probability < 0.20 as Low', () => {
        expect(ComputePredictiveWinRiskBand(0)).toBe('Low');
        expect(ComputePredictiveWinRiskBand(0.05)).toBe('Low');
        expect(ComputePredictiveWinRiskBand(0.1999)).toBe('Low');
    });

    it('classifies probability between 0.20 and 0.50 as Medium', () => {
        expect(ComputePredictiveWinRiskBand(0.20)).toBe('Medium');
        expect(ComputePredictiveWinRiskBand(0.35)).toBe('Medium');
        expect(ComputePredictiveWinRiskBand(0.4999)).toBe('Medium');
    });

    it('classifies probability between 0.50 and 0.80 as High', () => {
        expect(ComputePredictiveWinRiskBand(0.50)).toBe('High');
        expect(ComputePredictiveWinRiskBand(0.65)).toBe('High');
        expect(ComputePredictiveWinRiskBand(0.7999)).toBe('High');
    });

    it('classifies probability >= 0.80 as Critical', () => {
        expect(ComputePredictiveWinRiskBand(0.80)).toBe('Critical');
        expect(ComputePredictiveWinRiskBand(0.95)).toBe('Critical');
        expect(ComputePredictiveWinRiskBand(1.0)).toBe('Critical');
    });
});

describe('DealEntityServer.syncPredictiveWinFieldsPreSave', () => {
    it('synchronizes risk band when probability is set and risk band is missing', () => {
        const mockDeal: {
            PredictedWinProbability: number | null;
            PredictedWinRiskBand: DealEntity['PredictedWinRiskBand'];
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedWinProbability: 0.65,
            PredictedWinRiskBand: null,
            GetFieldByName: () => ({ Dirty: false }),
        };

        DealEntityServer.prototype.syncPredictiveWinFieldsPreSave.call(mockDeal);
        expect(mockDeal.PredictedWinRiskBand).toBe('High');
    });

    it('synchronizes risk band when probability is dirty even if risk band already exists', () => {
        const mockDeal: {
            PredictedWinProbability: number | null;
            PredictedWinRiskBand: DealEntity['PredictedWinRiskBand'];
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedWinProbability: 0.85,
            PredictedWinRiskBand: 'Low',
            GetFieldByName: () => ({ Dirty: true }),
        };

        DealEntityServer.prototype.syncPredictiveWinFieldsPreSave.call(mockDeal);
        expect(mockDeal.PredictedWinRiskBand).toBe('Critical');
    });

    it('clears risk band when probability is cleared and dirty', () => {
        const mockDeal: {
            PredictedWinProbability: number | null;
            PredictedWinRiskBand: DealEntity['PredictedWinRiskBand'];
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedWinProbability: null,
            PredictedWinRiskBand: 'High',
            GetFieldByName: () => ({ Dirty: true }),
        };

        DealEntityServer.prototype.syncPredictiveWinFieldsPreSave.call(mockDeal);
        expect(mockDeal.PredictedWinRiskBand).toBeNull();
    });

    it('leaves risk band alone when probability is not dirty and risk band is present', () => {
        const mockDeal: {
            PredictedWinProbability: number | null;
            PredictedWinRiskBand: DealEntity['PredictedWinRiskBand'];
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedWinProbability: 0.15,
            PredictedWinRiskBand: 'High',
            GetFieldByName: () => ({ Dirty: false }),
        };

        DealEntityServer.prototype.syncPredictiveWinFieldsPreSave.call(mockDeal);
        expect(mockDeal.PredictedWinRiskBand).toBe('High');
    });
});
