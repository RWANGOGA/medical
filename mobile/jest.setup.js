// Shared jest setup: mock native modules that have no JS-only implementation.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest")
);
