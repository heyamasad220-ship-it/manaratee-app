"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ticketCodeFromQrPayload } from "@/lib/tickets/ticket-qr-payload"
import { cn } from "@/lib/utils"

type BarcodeHit = { rawValue: string }

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<BarcodeHit[]>
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike
    }
  ).BarcodeDetector
  if (!Detector) return null
  try {
    return new Detector({ formats: ["qr_code"] })
  } catch {
    return null
  }
}

async function openRearCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    })
  }
}

export function TicketQrCamera({
  onCode,
  paused = false,
}: {
  onCode: (code: string) => void
  paused?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const decodeJsQrRef = useRef<
    ((data: ImageData) => { data: string } | null) | null
  >(null)
  const jsQrLoadRef = useRef<Promise<void> | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null | undefined>(undefined)
  const lastSentRef = useRef({ code: "", at: 0 })
  const pausedRef = useRef(paused)
  const onCodeRef = useRef(onCode)

  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  pausedRef.current = paused
  onCodeRef.current = onCode

  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopCamera() {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const stream = streamRef.current
    streamRef.current = null
    stream?.getTracks().forEach((track) => track.stop())
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setRunning(false)
    setStarting(false)
  }

  function emitCode(raw: string) {
    const code = ticketCodeFromQrPayload(raw)
    if (!code) return
    const now = Date.now()
    if (code === lastSentRef.current.code && now - lastSentRef.current.at < 2500) {
      return
    }
    lastSentRef.current = { code, at: now }
    onCodeRef.current(code)
  }

  async function decodeFrame(video: HTMLVideoElement) {
    if (pausedRef.current || video.readyState < 2) return

    const detector =
      detectorRef.current === undefined
        ? (detectorRef.current = getBarcodeDetector())
        : detectorRef.current
    if (detector) {
      try {
        const hits = await detector.detect(video)
        const value = hits[0]?.rawValue
        if (value) {
          emitCode(value)
        }
        return
      } catch {
        // Fall through to jsQR.
      }
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return

    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return
    context.drawImage(video, 0, 0, width, height)
    const imageData = context.getImageData(0, 0, width, height)

    if (!decodeJsQrRef.current) {
      if (!jsQrLoadRef.current) {
        jsQrLoadRef.current = import("jsqr").then(({ default: jsQR }) => {
          decodeJsQrRef.current = (data) =>
            jsQR(data.data, data.width, data.height, {
              inversionAttempts: "attemptBoth",
            })
        })
      }
      await jsQrLoadRef.current
    }

    const result = decodeJsQrRef.current(imageData)
    if (result?.data) {
      emitCode(result.data)
    }
  }

  function loop() {
    const video = videoRef.current
    if (!video || !streamRef.current) return
    void decodeFrame(video).finally(() => {
      if (!streamRef.current) return
      frameRef.current = window.requestAnimationFrame(loop)
    })
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser cannot open the camera. Use HTTPS (or localhost) in Safari or Chrome, or type the ticket code."
      )
      return
    }
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost"
    ) {
      setError(
        "Camera scan needs a secure (https) connection. Type the ticket code, or open this page over https."
      )
      return
    }

    setError(null)
    setStarting(true)

    try {
      const stream = await openRearCamera()
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        throw new Error("Camera preview was not ready. Try again.")
      }
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      video.muted = true
      await video.play()
      setRunning(true)
      setStarting(false)
      loop()
    } catch (startError) {
      stopCamera()
      const denied =
        startError instanceof DOMException &&
        (startError.name === "NotAllowedError" || startError.name === "PermissionDeniedError")
      setError(
        denied
          ? "Camera permission was blocked. Allow camera access for this site, then tap Start camera again."
          : startError instanceof Error
            ? startError.message
            : "Could not start the camera. Type the ticket code instead."
      )
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border bg-black",
          running ? "aspect-[3/4] sm:aspect-video" : "aspect-[3/4] max-h-64 sm:aspect-video sm:max-h-none"
        )}
      >
        <video
          ref={videoRef}
          className={cn(
            "h-full w-full object-cover",
            running ? "opacity-100" : "opacity-0"
          )}
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        {running ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] sm:h-48 sm:w-48" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
            <Camera className="h-8 w-8 opacity-80" />
            <p className="text-sm text-white/90">
              Point the phone camera at the guest&apos;s ticket QR.
            </p>
          </div>
        )}
        {paused && running ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-center text-sm text-white">
            Checking in…
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {running ? (
          <Button type="button" variant="outline" onClick={stopCamera}>
            <CameraOff className="mr-2 h-4 w-4" />
            Stop camera
          </Button>
        ) : (
          <Button type="button" onClick={() => void startCamera()} disabled={starting}>
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            Start camera
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
