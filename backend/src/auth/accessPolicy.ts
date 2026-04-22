export type RegistrationMode = "disabled" | "public" | "link_only";

const isRegistrationMode = (value: string | null | undefined): value is RegistrationMode =>
  value === "disabled" || value === "public" || value === "link_only";

export const getEffectiveRegistrationMode = (
  authMode: "local" | "hybrid" | "oidc_enforced",
  systemConfig: {
    registrationMode?: string | null;
    registrationEnabled?: boolean | null;
  }
): RegistrationMode => {
  if (authMode === "oidc_enforced") return "disabled";

  if (isRegistrationMode(systemConfig.registrationMode)) {
    return systemConfig.registrationMode;
  }

  return systemConfig.registrationEnabled ? "public" : "disabled";
};

export const getEffectiveOidcJitProvisioning = (
  options: {
    oidcEnabled: boolean;
    defaultJitProvisioningEnabled: boolean;
  },
  systemConfig: {
    oidcJitProvisioningEnabled: boolean | null;
  }
): boolean => {
  if (!options.oidcEnabled) return false;
  return typeof systemConfig.oidcJitProvisioningEnabled === "boolean"
    ? systemConfig.oidcJitProvisioningEnabled
    : options.defaultJitProvisioningEnabled;
};

export const getEffectiveRegistrationEnabled = (
  authMode: "local" | "hybrid" | "oidc_enforced",
  systemConfig: {
    registrationMode?: string | null;
    registrationEnabled?: boolean | null;
  }
): boolean => getEffectiveRegistrationMode(authMode, systemConfig) === "public";
