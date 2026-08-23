/**
 * Parses request files in a pool of Web Workers (see parse.worker.js). The
 * full .bru/.yml parser costs ~1ms per file, so an 8000-request collection is
 * 8s of blocked UI if parsed on the main thread; spread over the cores it is
 * a second or two and the sidebar keeps responding. Falls back to chunked
 * main-thread parsing where workers are unavailable or fail to boot.
 */
import { parseRequest } from './filestore';

const BATCH_SIZE = 200;
const POOL_SIZE = Math.max(2, Math.min(8, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1);

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const parseOnMainThread = async (jobs, onResults) => {
  for (const batch of chunk(jobs, 50)) {
    onResults(batch.map(({ pathname, content, format }) => {
      try {
        return { pathname, data: parseRequest(content, { format }) };
      } catch (error) {
        return { pathname, error: error?.message || String(error) };
      }
    }));
    // yield so the sidebar can paint between batches
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const createWorker = () => {
  try {
    return new Worker(new URL('./parse.worker.js', import.meta.url));
  } catch (_error) {
    return null;
  }
};

/**
 * @param {Array<{pathname: string, content: string, format: 'bru'|'yml'}>} jobs
 * @param {(results: Array<{pathname: string, data?: object, error?: string}>) => void} onResults
 *   called per finished batch, in no particular order
 */
export const parseRequestFiles = async (jobs, onResults) => {
  if (!jobs.length) return;
  if (typeof Worker === 'undefined') {
    await parseOnMainThread(jobs, onResults);
    return;
  }

  const batches = chunk(jobs, BATCH_SIZE);
  const workers = Array.from({ length: Math.min(POOL_SIZE, batches.length) }, createWorker).filter(Boolean);
  if (!workers.length) {
    await parseOnMainThread(jobs, onResults);
    return;
  }

  let next = 0;
  let failed = false;
  const done = new Set();
  const runOn = (worker) => new Promise((resolve) => {
    const pump = () => {
      if (failed || next >= batches.length) {
        resolve();
        return;
      }
      const id = next++;
      worker.onmessage = ({ data }) => {
        done.add(id);
        onResults(data.results);
        pump();
      };
      worker.onerror = (event) => {
        // bundle/boot failure — whatever never came back is parsed on the main thread below
        console.warn('[web-ipc] parse worker failed, falling back to main thread', event?.message || event);
        failed = true;
        resolve();
      };
      worker.postMessage({ id, jobs: batches[id] });
    };
    pump();
  });

  await Promise.all(workers.map(runOn));
  workers.forEach((worker) => worker.terminate());

  const leftovers = batches.filter((_, id) => !done.has(id)).flat();
  if (leftovers.length) {
    await parseOnMainThread(leftovers, onResults);
  }
};
