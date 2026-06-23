import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showText?: boolean;
  textClassName?: string;
};

export function Logo({ className = "h-9 w-9", showText = true, textClassName }: LogoProps) {
  return (
    <>
      <img
        src="/logo.png"
        alt="Buzzket"
        className={cn("rounded-lg object-cover", className)}
      />
      {showText ? (
        <span className={cn("tracking-tight", textClassName)}>buzzket</span>
      ) : null}
    </>
  );
}
