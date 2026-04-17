import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { CryptoQuickSelect } from '@/components/CryptoQuickSelect';
import { UpDownDisplay } from '@/components/UpDownDisplay';
import { EventHistory } from '@/components/EventHistory';
import { ProbabilityEngine } from '@/components/ProbabilityEngine';
import { RulesEngine } from '@/components/RulesEngine';
import { GovernancePanel } from '@/components/GovernancePanel';
import { useUpDownMarkets } from '@/hooks/useUpDownMarkets';
import { useTradingEngine } from '@/hooks/useTradingEngine';
import { useCryptoPrice } from '@/hooks/useCryptoPrice';
import { usePriceHistory } from '@/hooks/usePriceHistory';

const Index = () => {
  const upDown = useUpDownMarkets({ pollInterval: 20000 });
  const engine = useTradingEngine();
  const cryptoPrice = useCryptoPrice(upDown.selectedAsset);
  const { history: priceHistory, reset: resetHistory } = usePriceHistory(cryptoPrice.price);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Reset price history when asset changes
  useEffect(() => { resetHistory(); }, [resetHistory, upDown.selectedAsset]);

  useEffect(() => {
    if (upDown.activeMarket && upDown.activeMarket.upPrice !== null) {
      const m = upDown.activeMarket;
      const firstMkt = m.markets[0];
      if (firstMkt) {
        const nextMarket = {
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
        };
        if (!engine.selectedMarket || engine.selectedMarket.id !== nextMarket.id) {
          engine.selectMarket(nextMarket);
        } else if (nextMarket.yesPrice !== engine.selectedMarket.yesPrice) {
          engine.processObservation(nextMarket);
        }
      }
    }
  }, [upDown.activeMarket, engine.selectedMarket, engine.selectMarket, engine.processObservation]);

  return (
    <div className="grid grid-rows-[44px_1fr] h-screen overflow-hidden">
      <TopBar
        isLive={engine.isLive}
        brierScore={engine.brierState.score}
        nParticles={5000}
        spotPrice={cryptoPrice.price}
        spotAsset={upDown.selectedAsset}
        spotConnected={cryptoPrice.connected}
        rightCollapsed={rightCollapsed}
        onToggleRight={() => setRightCollapsed(v => !v)}
      />

      <div className={`grid overflow-hidden transition-[grid-template-columns] duration-200 ${
        rightCollapsed
          ? 'grid-cols-[200px_1fr]'
          : 'grid-cols-[200px_1fr_180px]'
      }`}>
        {/* Left: Discovery + Event History */}
        <div className="border-r border-border overflow-y-auto overflow-x-hidden scrollbar-thin flex flex-col min-w-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-background z-20">
            <span className="text-[8px] tracking-[1.5px] text-muted-foreground uppercase font-mono font-medium">
              MARKETS
            </span>
            <span className="text-[8px] px-1 py-0.5 bg-secondary text-muted-foreground rounded font-mono">
              {upDown.allMarkets.length}
            </span>
          </div>

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
            liveSpotPrice={cryptoPrice.price}
            spotConnected={cryptoPrice.connected}
            clobConnected={upDown.clobConnected}
            clobLastUpdate={upDown.clobLastUpdate}
          />

          <EventHistory
            allMarkets={upDown.allMarkets}
            activeMarketId={upDown.activeMarket?.eventId || null}
          />
        </div>

        {/* Center: Probability Engine — The Main Stage */}
        <div className="border-r border-border overflow-hidden flex flex-col min-w-0">
          <ProbabilityEngine
            market={engine.selectedMarket}
            pfState={engine.pfState}
            mcResult={engine.mcResult}
            brierState={engine.brierState}
            decision={engine.decision}
            getParticles={engine.getParticleProbabilities}
            liveSpotPrice={cryptoPrice.price}
            spotAsset={upDown.selectedAsset}
            upDownMarket={upDown.activeMarket}
            priceHistory={priceHistory}
          />
          <RulesEngine rules={engine.rules} />
        </div>

        {/* Right: Governance */}
        {!rightCollapsed && (
          <GovernancePanel governance={engine.governance} />
        )}
      </div>
    </div>
  );
};

export default Index;
