export const isBillingEnabled = import.meta.env.VITE_USE_EMULATORS === "false" ||
  import.meta.env.VITE_BILLING_SIMULATION === "true" && import.meta.env.VITE_EMULATOR_PROFILE === "test";
