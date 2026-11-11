import { DEPLOYMENT_MODE, DEPLOYMENTS } from "@/config/deployment";
import { table, type Builder } from "./shared";

/**
 * Data export & backup. The school owns its data in every deployment mode, so
 * it can always export it; who keeps the backups depends on who hosts.
 */
const dataExport: Builder = ({ tenant }) => {
  const info = DEPLOYMENTS[DEPLOYMENT_MODE];
  const school = tenant?.name ?? "the school";
  const selfHosted = DEPLOYMENT_MODE === "self_hosted";
  return {
    description: `Backups and exports for ${school}. ${info.backups}.`,
    actions: ["Run backup now", "Export data"],
    kpis: [
      { title: "Hosting", caption: "Where this school runs", value: info.label, note: `Run by ${info.operator.toLowerCase()}` },
      { title: "Last backup", caption: "Most recent", value: "Today 02:00", note: "Completed" },
      { title: "Backup schedule", caption: "Automatic", value: "Daily", note: selfHosted ? "Set on the school's server" : "30-day retention" },
      { title: "Data location", caption: "Where backups are kept", value: selfHosted ? "School storage" : "ACURIS cloud", note: selfHosted ? "Copy offsite regularly" : "Zambian region" },
    ],
    tables: [
      table(
        "Backups",
        ["Date", "Type", "Size", "Kept by", "Status"],
        [
          ["11 Nov 2026 02:00", "Automatic", "1.8 GB", info.operator, "Completed"],
          ["10 Nov 2026 02:00", "Automatic", "1.8 GB", info.operator, "Completed"],
          ["09 Nov 2026 14:12", "Manual", "1.8 GB", info.operator, "Completed"],
          ["09 Nov 2026 02:00", "Automatic", "1.7 GB", info.operator, "Completed"],
        ],
        { statusColumn: "Status" },
      ),
      table(
        "Data exports",
        ["Dataset", "Format", "Last export", "Status"],
        [
          ["Students and guardians", "CSV", "01 Nov 2026", "Ready"],
          ["Fee accounts and payments", "CSV", "01 Nov 2026", "Ready"],
          ["Results and transcripts", "CSV", "28 Oct 2026", "Ready"],
          ["Full school archive", "ZIP", "Never", "Not run"],
        ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

export const dataScreens = { "data-export-and-backup": dataExport };
