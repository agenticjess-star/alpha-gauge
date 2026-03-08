import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { CryptoQuickSelect } from '@/components/CryptoQuickSelect';
import { UpDownDisplay } from '@/components/UpDownDisplay';
import { EventHistory } from '@/components/EventHistory';
import { ProbabilityEngine } from '@/components/ProbabilityEngine';
import { RulesEngine } from '@/components/RulesEngine';
import { GovernancePanel } from '@/components/GovernancePanel';
import { useMarkets } from '@/hooks/useMarkets';
import { useUpDownMarkets } from '@/hooks/useUpDownMarkets';
import { useTradingEngine } from '@/hooks/useTradingEngine';
import { useCryptoPrice } from '@/hooks/useCryptoPrice';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

const Index = () => {
  const { markets, loading, error } = useMarkets(30000);
  const upDown = useUpDownMarkets({ pollInterval: 20000 });
  const engine = useTradingEngine();
  const cryptoPrice = useCryptoPrice(upDown.selectedAsset);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Feed live spot price changes into particle filter
  useEffect(() => {
    if (cryptoPrice.price !== null && engine.isLive && engine.selectedMarket) {
      // Normalize: if market is probability-based (0-1), we don't feed raw USD price
      // Instead we use it for display; the particle filter gets fed from market price updates
    }
  }, [cryptoPrice.price]);

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

  // When an up/down market is discovered, auto-select it as active
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
        spotPrice={cryptoPrice.price}
        spotAsset={upDown.selectedAsset}
        spotConnected={cryptoPrice.connected}
        rightCollapsed={rightCollapsed}
        onToggleRight={() => setRightCollapsed(v => !v)}
      />

      <div className={`grid overflow-hidden transition-[grid-template-columns] duration-200 ${
        rightCollapsed
          ? 'grid-cols-[220px_1fr]'
          : 'grid-cols-[220px_1fr_200px]'
      }`}>
        {/* Left: Discovery + Event History */}
        <div className="border-r border-border overflow-y-auto overflow-x-hidden scrollbar-thin flex flex-col min-w-0">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between sticky top-0 bg-background z-20">
            <span className="text-[9px] tracking-[1.5px] text-muted-foreground uppercase font-medium">
              UP/DOWN
            </span>
            <span className="text-[9px] px-1 py-0.5 bg-secondary text-muted-foreground rounded font-mono">
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

        {/* Center: Probability Engine */}
        <div className="border-r border-border overflow-hidden flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <ProbabilityEngine
              market={engine.selectedMarket}
              pfState={engine.pfState}
              mcResult={engine.mcResult}
              brierState={engine.brierState}
              decision={engine.decision}
              getParticles={engine.getParticleProbabilities}
              liveSpotPrice={cryptoPrice.price}
              spotAsset={upDown.selectedAsset}
            />
            <RulesEngine rules={engine.rules} />
          </div>
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
