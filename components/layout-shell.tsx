"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Heart, TableProperties } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { PatientSearchBar } from "@/components/patient-search-bar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const AUTH_ROUTES = ["/auth/signin", "/auth/signup"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center justify-between gap-4 border-b px-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Heart size={20} color="#00703f" fill="#00703f" />
          <span className="text-[#00703f] font-bold text-lg">Lifeforce</span>
        </Link>
        <div className="flex flex-1 items-center justify-center gap-2">
          <PatientSearchBar />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/patientsearch">
                    <TableProperties className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Patient Search</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <UserMenu />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
