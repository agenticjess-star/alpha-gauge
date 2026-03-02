import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { MarketsPanel } from '@/components/MarketsPanel';
import { ProbabilityEngine } from '@/components/ProbabilityEngine';
import { RulesEngine } from '@/components/RulesEngine';
import { GovernancePanel } from '@/components/GovernancePanel';
import { useMarkets } from '@/hooks/useMarkets';
import { useTradingEngine } from '@/hooks/useTradingEngine';
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react';

const Index = () => {
  const { markets, loading, error } = useMarkets(30000);
  const engine = useTradingEngine();
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    if (!engine.selectedMarket || markets.length === 0) return;
    const updated = markets.find(m => m.id === engine.selectedMarket!.id);
    if (updated && updated.yesPrice !== engine.selectedMarket.yesPrice) {
      engine.processObservation(updated);
    }
  }, [markets]);

  useEffect(() => {
    if (!engine.selectedMarket && markets.length > 0) {
      engine.selectMarket(markets[0]);
    }
  }, [markets]);

  return (
    <div className="grid grid-rows-[44px_1fr] h-screen overflow-hidden">
      <TopBar
        isLive={engine.isLive}
        brierScore={engine.brierState.score}
        nParticles={5000}
        rightCollapsed={rightCollapsed}
        onToggleRight={() => setRightCollapsed(v => !v)}
      />

      <div className={`grid overflow-hidden transition-[grid-template-columns] duration-200 ${
        rightCollapsed
          ? 'grid-cols-[240px_1fr]'
          : 'grid-cols-[240px_1fr_220px]'
      }`}>
        <MarketsPanel
          markets={markets}
          selectedId={engine.selectedMarket?.id || null}
          onSelect={engine.selectMarket}
          loading={loading}
          error={error}
        />

        <div className="border-r border-border overflow-hidden flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
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

        {!rightCollapsed && (
          <GovernancePanel governance={engine.governance} />
        )}
      </div>
    </div>
  );
};

export default Index;
