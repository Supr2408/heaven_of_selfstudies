import { create } from 'zustand';

/**
 * Global state management using Zustand
 */
const useStore = create((set, get) => ({
  // Auth state
  user: null,
  token: null,
  isAuthenticated: false,

  // UI state
  sidebarOpen: true,
  currentTheme: 'light',

  // Content state
  selectedSubject: null,
  selectedCourse: null,
  selectedYear: null,
  selectedWeek: null,
  contentVersion: 0,

  // Chat state
  currentRoomId: null,
  messages: [],
  onlineUsers: 0,
  isTyping: false,

  // Resources state
  resources: [],
  resourceFilter: 'all',

  // Auth actions
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token, isAuthenticated: !!token }),
  logout: () => set({
    user: null,
    token: null,
    isAuthenticated: false,
    messages: [],
    currentRoomId: null,
  }),

  // UI actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ currentTheme: theme }),

  // Navigation actions
  setSelectedSubject: (subject) => set({ selectedSubject: subject }),
  setSelectedCourse: (course) => set({ selectedCourse: course }),
  setSelectedYear: (year) => set({ selectedYear: year }),
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  bumpContentVersion: () =>
    set((state) => ({ contentVersion: state.contentVersion + 1 })),

  // Chat actions
  setCurrentRoom: (roomId) => set({ currentRoomId: roomId, messages: [] }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  setMessages: (messages) => set({ messages }),
  updateMessage: (messageId, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg._id === messageId ? { ...msg, ...updates } : msg
    ),
  })),
  deleteMessage: (messageId) => set((state) => ({
    messages: state.messages.filter((msg) => msg._id !== messageId),
  })),
  setOnlineUsers: (count) => set({ onlineUsers: count }),
  setIsTyping: (typing) => set({ isTyping: typing }),

  // Resources actions
  setResources: (resources) => set({ resources }),
  addResource: (resource) => set((state) => ({
    resources: [resource, ...state.resources],
  })),
  setResourceFilter: (filter) => set({ resourceFilter: filter }),
  updateResource: (resourceId, updates) => set((state) => ({
    resources: state.resources.map((res) =>
      res._id === resourceId ? { ...res, ...updates } : res
    ),
  })),
  removeResource: (resourceId) => set((state) => ({
    resources: state.resources.filter((res) => res._id !== resourceId),
  })),

  // Utility
  reset: () => set({
    user: null,
    token: null,
    isAuthenticated: false,
    selectedSubject: null,
    selectedCourse: null,
    selectedYear: null,
    selectedWeek: null,
    contentVersion: 0,
    currentRoomId: null,
    messages: [],
  }),
}));

export default useStore;
