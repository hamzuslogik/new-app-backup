import { useEffect } from 'react';
import { attachIosNestedScrollChain } from '../utils/iosNestedScrollChain';

/**
 * iOS Safari : scroll imbriqué (tableau → panneau modal) en H et V.
 */
export function useIosNestedScrollChain(boundaryRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    let detach = () => {};
    const frameId = requestAnimationFrame(() => {
      const el = boundaryRef?.current;
      if (el) detach = attachIosNestedScrollChain(el);
    });

    return () => {
      cancelAnimationFrame(frameId);
      detach();
    };
  }, [boundaryRef, enabled]);
}

export default useIosNestedScrollChain;
