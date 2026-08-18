export type AppZone = "pieces" | "ventes" | "centres";

export function zoneFromPath(pathname: string): AppZone {
  if (pathname === "/ventes" || pathname.startsWith("/ventes/")) return "ventes";
  if (pathname === "/centres" || pathname.startsWith("/centres/")) return "centres";
  return "pieces";
}