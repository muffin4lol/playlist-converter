import { AudioLines } from "lucide-react";
import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <AudioLines size={22} />
      </span>
      playlist<span className="brand-light">converter</span>
      <span className="beta">BETA</span>
    </Link>
  );
}
