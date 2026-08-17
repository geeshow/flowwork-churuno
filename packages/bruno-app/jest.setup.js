global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom has no crypto.randomUUID; browser code (e.g. workflow execution ids) relies on it
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.randomUUID) {
  let counter = 0;
  global.crypto.randomUUID = () => `test-uuid-${(counter += 1)}`;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
});

jest.mock('nanoid', () => {
  return {
    nanoid: () => {}
  };
});

jest.mock('strip-json-comments', () => {
  return {
    stripJsonComments: (str) => str
  };
});
