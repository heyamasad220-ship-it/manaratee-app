declare module "jsqr" {
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: {
      inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth"
    }
  ): { data: string; location?: unknown } | null
}
