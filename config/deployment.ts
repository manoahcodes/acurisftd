/**
 * Who hosts this copy of ACURIS.
 *
 *   cloud       Shared, multi-tenant, hosted and run by ACURIS. Platform Admins
 *               see every school and pick which one to work in.
 *   dedicated   One school on its own deployment, still run by ACURIS.
 *   self_hosted One school on its own deployment, run by the school's own IT.
 *
 * Single-school modes (dedicated, self_hosted) have no tenant list, school
 * switcher or cross-school pages: the top admin is the school's own admin and
 * can only ever see that one school. Set it with NEXT_PUBLIC_ACURIS_DEPLOYMENT
 * (public so client components see the same value). Unset means "cloud".
 */
export const DEPLOYMENT_MODES = ["cloud", "dedicated", "self_hosted"] as const;
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];

/**
 * An unknown value throws instead of falling back: a typo on a school's server
 * must not quietly turn on the multi-tenant view.
 */
export function parseDeploymentMode(value: string | undefined): DeploymentMode {
  const v = value?.trim();
  if (!v) return "cloud";
  if ((DEPLOYMENT_MODES as readonly string[]).includes(v)) return v as DeploymentMode;
  throw new Error(
    `Unknown ACURIS deployment mode "${v}". Use one of: ${DEPLOYMENT_MODES.join(", ")}.`,
  );
}

export const DEPLOYMENT_MODE: DeploymentMode = parseDeploymentMode(
  process.env.NEXT_PUBLIC_ACURIS_DEPLOYMENT,
);

export const isMultiTenant = (mode: DeploymentMode = DEPLOYMENT_MODE) => mode === "cloud";

type DeploymentInfo = {
  label: string;
  /** Who runs the servers and looks after backups. */
  operator: "ACURIS" | "The school";
  /** Label of the top-level admin role. */
  adminLabel: string;
  backups: string;
};

export const DEPLOYMENTS: Record<DeploymentMode, DeploymentInfo> = {
  cloud: {
    label: "Shared cloud",
    operator: "ACURIS",
    adminLabel: "Platform Admin",
    backups: "Daily backups kept by ACURIS for 30 days",
  },
  dedicated: {
    label: "Dedicated hosting",
    operator: "ACURIS",
    adminLabel: "School Admin",
    backups: "Daily backups kept by ACURIS for 30 days",
  },
  self_hosted: {
    label: "Self-hosted",
    operator: "The school",
    adminLabel: "School Admin",
    backups: "Backups are stored and kept by the school",
  },
};
