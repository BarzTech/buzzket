import { Link } from "@tanstack/react-router";
import { Ticket } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Ticket className="h-4 w-4" />
            </span>
            buzzket
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Uganda&apos;s home for events, festivals and unforgettable nights.
          </p>
        </div>
        <div>
          <h4 className="font-semibold">Attend</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/browse" search={{ q: "" }} className="hover:text-primary">
                Browse events
              </Link>
            </li>
            <li>
              <Link to="/categories" className="hover:text-primary">
                Categories
              </Link>
            </li>
            <li>
              <Link to="/cities" className="hover:text-primary">
                Cities
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold">Organize</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/sell-tickets" className="hover:text-primary">
                Sell tickets
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-primary">
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/resources" className="hover:text-primary">
                Resources
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-primary">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-primary">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} buzzket. All rights reserved.
      </div>
    </footer>
  );
}
