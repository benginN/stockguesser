/** navigator.share on mobile, clipboard fallback elsewhere (ROADMAP §4). */
import { useState } from "react";

export default function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // user cancelled or unsupported payload — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; nothing sensible left to do
    }
  };

  return (
    <button
      onClick={share}
      className="bg-accent min-h-11 w-full rounded-md px-4 py-2.5 font-bold text-black transition-transform active:scale-95"
    >
      {copied ? "Copied! 📋" : "Share result"}
    </button>
  );
}
