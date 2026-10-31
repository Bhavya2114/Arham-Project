import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Keeps a list page from scrolling: the box behind the returned ref gets a maxHeight
 * that fills what is left of the screen below it (same idea as the purchase item list).
 * `deps` should change whenever something above the box can change height.
 * `extra` is space to keep under the box (e.g. its card's bottom border).
 */
export default function useFitHeight(deps = [], { min = 240, extra = 1 } = {}) {
  const ref = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);

  useLayoutEffect(() => {
    const fit = () => {
      const box = ref.current;
      if (!box) return;
      const main = box.closest('main');
      const mainBottom = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = box.getBoundingClientRect().top + (main ? main.scrollTop : 0);
      setMaxHeight(Math.max(min, Math.floor(mainBottom - top - mainPad - extra)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, maxHeight];
}
