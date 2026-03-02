import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { MarketsPanel } from '@/components/MarketsPanel';
import { CryptoQuickSelect } from '@/components/CryptoQuickSelect';
import { UpDownDisplay } from '@/components/UpDownDisplay';
import { ProbabilityEngine } from '@/components/ProbabilityEngine';
import { RulesEngine } from '@/components/RulesEngine';
import { GovernancePanel } from '@/components/GovernancePanel';
import { useMarkets } from '@/hooks/useMarkets';
import { useUpDownMarkets } from '@/hooks/useUpDownMarkets';
import { useTradingEngine } from '@/hooks/useTradingEngine';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

const Index = () => {
  const { markets, loading, error } = useMarkets(30000);
  const upDown = useUpDownMarkets({ pollInterval: 20000 });
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

  // When an up/down market is discovered, auto-select it as the active trading market
  useEffect(() => {
    if (upDown.activeMarket && upDown.activeMarket.upPrice !== null) {
      const m = upDown.activeMarket;
      const firstMkt = m.markets[0];
      if (firstMkt) {
        engine.selectMarket({
          id: firstMkt.id,
          question: m.eventTitle,
          slug: m.eventSlug,
          yesPrice: m.upPrice ?? 0.5,
          noPrice: m.downPrice ?? 0.5,
          volume: parseFloat(firstMkt.volume) || 0,
          liquidity: parseFloat(firstMkt.liquidity) || 0,
          endDate: m.endDate,
          active: true,
          closed: false,
        });
      }
    }
  }, [upDown.activeMarket?.eventId]);

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
        >
          <CryptoQuickSelect
            activeAsset={upDown.selectedAsset}
            activeTimeframe={upDown.selectedTimeframe}
            onAssetChange={upDown.setSelectedAsset}
            onTimeframeChange={upDown.setSelectedTimeframe}
            assetCounts={upDown.assetCounts}
          />
          <UpDownDisplay
            market={upDown.activeMarket}
            loading={upDown.loading}
            error={upDown.error}
          />
        </MarketsPanel>

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
