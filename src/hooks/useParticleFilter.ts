import { useRef, useCallback, useState } from 'react';
import { ParticleFilter } from '@/lib/particleFilter';
import type { ParticleFilterState } from '@/lib/types';

export function useParticleFilter(priorProb = 0.5) {
  const pfRef = useRef(new ParticleFilter({ priorProb }));
  const [state, setState] = useState<ParticleFilterState>(pfRef.current.getState());

  const update = useCallback((observedPrice: number) => {
    pfRef.current.update(observedPrice);
    setState(pfRef.current.getState());
  }, []);

  const reset = useCallback((newPrior: number) => {
    pfRef.current.reset(newPrior);
    setState(pfRef.current.getState());
  }, []);

  const getParticleProbabilities = useCallback(() => {
    return pfRef.current.getParticleProbabilities();
  }, []);

  return {
    state,
    update,
    reset,
    getParticleProbabilities,
    config: {
      nParticles: 5000,
      processVol: 0.03,
      obsNoise: 0.02,
    },
  };
}
