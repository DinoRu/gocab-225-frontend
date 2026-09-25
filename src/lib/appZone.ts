export type AppZone = "pieces" | "ventes" | "centres" | "tarifs";

export function zoneFromPath(pathname: string): AppZone {
  if (pathname === "/ventes" || pathname.startsWith("/ventes/")) return "ventes";
  if (pathname === "/centres" || pathname.startsWith("/centres/")) return "centres";
  if (pathname === "/tarifs" || pathname.startsWith("/tarifs/")) return "tarifs";
  return "pieces";
}

