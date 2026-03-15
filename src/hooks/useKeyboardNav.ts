import { useEffect } from 'react';
interface NavControls { next: () => void; prev: () => void; togglePlay: () => void; stopPlay: () => void; }
export function useKeyboardNav({ next, prev, togglePlay, stopPlay }: NavControls) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); stopPlay(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stopPlay(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [next, prev, togglePlay, stopPlay]);
}
