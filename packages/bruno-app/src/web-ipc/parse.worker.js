/**
 * Web Worker that runs the full request parser off the main thread — the
 * browser-side counterpart of bruno-electron's BruParserWorker. Receives a
 * batch of { pathname, content, format } and answers with parsed data (or the
 * error message) per file.
 */
import { parseRequest } from '@usebruno/filestore';

self.onmessage = ({ data }) => {
  const { id, jobs } = data;
  const results = jobs.map(({ pathname, content, format }) => {
    try {
      return { pathname, data: parseRequest(content, { format }) };
    } catch (error) {
      return { pathname, error: error?.message || String(error) };
    }
  });
  self.postMessage({ id, results });
};
