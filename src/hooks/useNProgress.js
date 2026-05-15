import { useEffect } from 'react';
import NProgress from 'nprogress';

/**
 * useNProgress — hook untuk trigger NProgress bar
 *
 * Cara pakai:
 * useNProgress(isLoading);
 *
 * Saat isLoading = true  → NProgress.start()
 * Saat isLoading = false → NProgress.done()
 */
const useNProgress = (isLoading) => {
  useEffect(() => {
    if (isLoading) {
      NProgress.start();
    } else {
      NProgress.done();
    }

    // Cleanup kalau komponen unmount saat masih loading
    return () => {
      NProgress.done();
    };
  }, [isLoading]);
};

export default useNProgress;