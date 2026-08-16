import { createSlice } from '@reduxjs/toolkit';

export const TABS = {
  CONSOLE: 'console',
  NETWORK: 'network'
};

export const TAB_IDENFIERS = Object.values(TABS);

const MAX_LOGS = 1000;
const MAX_DEBUG_ERRORS = 500;
const MAX_FLOWWORK_REQUESTS = 500;

const initialState = {
  logs: [],
  debugErrors: [],
  // 워크플로우(flowwork) 실행 중 프록시로 나간 API 호출 — 컬렉션 timeline과 합쳐
  // Network 탭에 표시된다 (엔트리 형태는 collection.timeline의 request 엔트리와 동일)
  flowworkRequests: [],
  isConsoleOpen: false,
  activeTab: 'console',
  filters: {
    info: true,
    warn: true,
    error: true,
    debug: true,
    log: true
  },
  networkFilters: {
    GET: true,
    POST: true,
    PUT: true,
    DELETE: true,
    PATCH: true,
    HEAD: true,
    OPTIONS: true
  },
  selectedRequest: null,
  selectedError: null
};

export const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {
    addLog: (state, action) => {
      const { type, args, timestamp } = action.payload;
      const newLog = {
        id: Date.now() + Math.random(),
        type: type || 'log',
        message: args ? args.join(' ') : '',
        args: args || [],
        timestamp: timestamp || new Date().toISOString()
      };

      state.logs.push(newLog);

      if (state.logs.length > MAX_LOGS) {
        state.logs = state.logs.slice(-MAX_LOGS);
      }
    },
    addDebugError: (state, action) => {
      const { message, stack, filename, lineno, colno, args, timestamp } = action.payload;
      const newError = {
        id: Date.now() + Math.random(),
        message: message || 'Unknown error',
        stack: stack,
        filename: filename,
        lineno: lineno,
        colno: colno,
        args: args || [],
        timestamp: timestamp || new Date().toISOString()
      };

      state.debugErrors.push(newError);

      if (state.debugErrors.length > MAX_DEBUG_ERRORS) {
        state.debugErrors = state.debugErrors.slice(-MAX_DEBUG_ERRORS);
      }
    },
    clearLogs: (state) => {
      state.logs = [];
    },
    clearDebugErrors: (state) => {
      state.debugErrors = [];
    },
    addFlowworkRequest: (state, action) => {
      state.flowworkRequests.push(action.payload);

      if (state.flowworkRequests.length > MAX_FLOWWORK_REQUESTS) {
        state.flowworkRequests = state.flowworkRequests.slice(-MAX_FLOWWORK_REQUESTS);
      }
    },
    openConsole: (state) => {
      state.isConsoleOpen = true;
    },
    closeConsole: (state) => {
      state.isConsoleOpen = false;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    updateFilter: (state, action) => {
      const { filterType, enabled } = action.payload;
      state.filters[filterType] = enabled;
    },
    toggleAllFilters: (state, action) => {
      const enabled = action.payload;
      Object.keys(state.filters).forEach((key) => {
        state.filters[key] = enabled;
      });
    },
    updateNetworkFilter: (state, action) => {
      const { method, enabled } = action.payload;
      state.networkFilters[method] = enabled;
    },
    toggleAllNetworkFilters: (state, action) => {
      const enabled = action.payload;
      Object.keys(state.networkFilters).forEach((key) => {
        state.networkFilters[key] = enabled;
      });
    },
    setSelectedRequest: (state, action) => {
      state.selectedRequest = action.payload;
    },
    clearSelectedRequest: (state) => {
      state.selectedRequest = null;
    },
    setSelectedError: (state, action) => {
      state.selectedError = action.payload;
    },
    clearSelectedError: (state) => {
      state.selectedError = null;
    }
  }
});

export const {
  addLog,
  addDebugError,
  clearLogs,
  clearDebugErrors,
  addFlowworkRequest,
  openConsole,
  closeConsole,
  setActiveTab,
  updateFilter,
  toggleAllFilters,
  updateNetworkFilter,
  toggleAllNetworkFilters,
  setSelectedRequest,
  clearSelectedRequest,
  setSelectedError,
  clearSelectedError
} = logsSlice.actions;

export default logsSlice.reducer;
