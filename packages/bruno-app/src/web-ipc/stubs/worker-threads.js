// Browser stub for node:worker_threads — only reached if a *ViaWorker
// filestore entry point is called, which web mode never does.
export class Worker {
  constructor() {
    throw new Error('worker_threads is not available in the browser');
  }
}
export const parentPort = null;
export default { Worker, parentPort };
