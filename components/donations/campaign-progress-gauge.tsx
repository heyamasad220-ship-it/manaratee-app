import { cn } from "@/lib/utils"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

type CampaignProgressGaugeProps = {
  title?: string
  raised: number
  goal: number | null
  className?: string
  size?: "sm" | "md" | "lg"
}

const SIZE_CONFIG = {
  sm: { width: 240, height: 168, raisedClass: "text-xl", titleClass: "text-xs" },
  md: { width: 300, height: 210, raisedClass: "text-2xl", titleClass: "text-sm" },
  lg: { width: 360, height: 252, raisedClass: "text-3xl", titleClass: "text-base" },
} as const

const GAUGE = {
  cx: 160,
  cy: 148,
  radius: 96,
  strokeWidth: 20,
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy - radius * Math.sin(radians),
  }
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, endAngle)
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

function valueToAngle(value: number, goal: number) {
  if (goal <= 0) return 180
  const ratio = Math.min(Math.max(value / goal, 0), 1.12)
  return 180 - ratio * 180
}

export function CampaignProgressGauge({
  title,
  raised,
  goal,
  className,
  size = "md",
}: CampaignProgressGaugeProps) {
  const config = SIZE_CONFIG[size]
  const normalizedGoal = goal && goal > 0 ? goal : null
  const needleAngle = normalizedGoal ? valueToAngle(raised, normalizedGoal) : 180
  const needleLength = GAUGE.radius - 28
  const needleTip = polarToCartesian(GAUGE.cx, GAUGE.cy, needleLength, needleAngle)
  const hubY = GAUGE.cy + 8

  const segments = normalizedGoal
    ? [
        { start: 180, end: 120, color: "#ef4444" },
        { start: 120, end: 60, color: "#f97316" },
        { start: 60, end: 0, color: "#22c55e" },
      ]
    : [{ start: 180, end: 0, color: "#94a3b8" }]

  const tickRatios = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {title ? (
        <p
          className={cn(
            "mb-2 max-w-full truncate text-center font-medium text-muted-foreground",
            config.titleClass
          )}
        >
          {title}
        </p>
      ) : null}

      <svg
        viewBox="0 0 320 210"
        width={config.width}
        height={config.height}
        role="img"
        aria-label={
          normalizedGoal
            ? `${formatDonationCurrency(raised)} raised of ${formatDonationCurrency(normalizedGoal)} goal`
            : `${formatDonationCurrency(raised)} raised`
        }
      >
        <circle
          cx={GAUGE.cx}
          cy={GAUGE.cy}
          r={GAUGE.radius + 14}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1.5}
        />

        {segments.map((segment) => (
          <path
            key={`${segment.start}-${segment.end}`}
            d={describeArc(
              GAUGE.cx,
              GAUGE.cy,
              GAUGE.radius,
              segment.start,
              segment.end
            )}
            fill="none"
            stroke={segment.color}
            strokeWidth={GAUGE.strokeWidth}
            strokeLinecap="butt"
          />
        ))}

        {normalizedGoal
          ? tickRatios.map((ratio) => {
              const angle = 180 - ratio * 180
              const inner = polarToCartesian(GAUGE.cx, GAUGE.cy, GAUGE.radius - 14, angle)
              const outer = polarToCartesian(GAUGE.cx, GAUGE.cy, GAUGE.radius + 14, angle)

              return (
                <line
                  key={ratio}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#334155"
                  strokeWidth={1}
                />
              )
            })
          : null}

        <text
          x={GAUGE.cx}
          y={GAUGE.cy - 18}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px] font-medium"
        >
          Total Raised
        </text>

        {normalizedGoal ? (
          <>
            <line
              x1={GAUGE.cx}
              y1={hubY}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke="#f97316"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={GAUGE.cx} cy={hubY} r={8} fill="#0f766e" stroke="#ffffff" strokeWidth={2} />
            <text x={52} y={188} className="fill-muted-foreground text-[11px] font-medium">
              $0
            </text>
            <text x={268} y={188} textAnchor="end" className="fill-muted-foreground text-[10px] font-medium">
              {formatDonationCurrency(normalizedGoal)}
            </text>
          </>
        ) : (
          <text x={GAUGE.cx} y={GAUGE.cy + 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            No goal set
          </text>
        )}
      </svg>

      <p className={cn("mt-1 font-bold tracking-tight text-foreground", config.raisedClass)}>
        {formatDonationCurrency(raised)}
      </p>

      {normalizedGoal ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {Math.round((raised / normalizedGoal) * 100)}% of{" "}
          {formatDonationCurrency(normalizedGoal)} goal
        </p>
      ) : null}
    </div>
  )
}
