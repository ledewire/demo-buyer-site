import Image from 'next/image'

/** The LedeWire wordmark, as on ledewire.com. The class sets its height; the width follows. */
export default function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <Image
      src="/ledewire-logo.png"
      alt="LedeWire"
      width={450}
      height={150}
      // A small static PNG: serve it as-is rather than through the image optimizer.
      unoptimized
      priority
      className={className}
    />
  )
}
