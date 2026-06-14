"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/map", label: "Station map" },
  { href: "/simulation", label: "Simulation lab" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg bg-[#edf3ef] p-1">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-white text-[#174d31] shadow-sm"
                : "text-[#5c6f64] hover:text-[#174d31]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
