import { Link } from "@tanstack/react-router";
import { Ticket, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Ticket className="h-5 w-5" />
          </span>
          <span className="tracking-tight">buzzket</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link to="/" className="hover:text-primary">Discover</Link>
          <a href="/#happening-soon" className="hover:text-primary">Happening Soon</a>
          <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" className="font-medium">
            <Link to="/dashboard">Sign in</Link>
          </Button>
          <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
            <Link to="/dashboard">Sell Tickets</Link>
          </Button>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm font-medium">
            <Link to="/" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-accent">Discover</Link>
            <a href="/#happening-soon" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-accent">Happening Soon</a>
            <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-accent">Dashboard</Link>
            <Button asChild className="mt-2 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
              <Link to="/dashboard" onClick={() => setOpen(false)}>Sell Tickets</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
