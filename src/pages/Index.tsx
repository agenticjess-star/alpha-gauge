import { useEffect, useCallback } from 'react';
import { TopBar } from '@/components/TopBar';
import { MarketsPanel } from '@/components/MarketsPanel';
import { ProbabilityEngine } from '@/components/ProbabilityEngine';
import { RulesEngine } from '@/components/RulesEngine';
import { GovernancePanel } from '@/components/GovernancePanel';
import { useMarkets } from '@/hooks/useMarkets';
import { useTradingEngine } from '@/hooks/useTradingEngine';

const Index = () => {
  const { markets, loading, error } = useMarkets(30000);
  const engine = useTradingEngine();

  // When markets update and we have a selected market, find the updated version and process it
  useEffect(() => {
    if (engine.selectedMarket && markets.length > 0) {
      const updated = markets.find(m => m.id === engine.selectedMarket!.id);
      if (updated && updated.yesPrice !== engine.selectedMarket.yesPrice) {
        engine.processObservation(updated);
      }
    }
  }, [markets]);

  // Auto-select first market if none selected
  useEffect(() => {
    if (!engine.selectedMarket && markets.length > 0) {
      engine.selectMarket(markets[0]);
    }
  }, [markets]);

  return (
    <div className="grid grid-rows-[48px_1fr] h-screen overflow-hidden">
      <TopBar
        isLive={engine.isLive}
        brierScore={engine.brierState.score}
        nParticles={5000}
      />

      <div className="grid grid-cols-[300px_1fr_280px] overflow-hidden">
        <MarketsPanel
          markets={markets}
          selectedId={engine.selectedMarket?.id || null}
          onSelect={engine.selectMarket}
          loading={loading}
          error={error}
        />

        <div className="border-r border-border overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <ProbabilityEngine
              market={engine.selectedMarket}
              pfState={engine.pfState}
              mcResult={engine.mcResult}
              brierState={engine.brierState}
              decision={engine.decision}
              getParticles={engine.getParticleProbabilities}
            />
            <RulesEngine rules={engine.rules} />
          </div>
        </div>

        <GovernancePanel governance={engine.governance} />
      </div>
    </div>
  );
};

export default Index;
