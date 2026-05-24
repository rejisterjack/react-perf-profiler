import { Activity, Circle, AlertTriangle } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useBridgeStore } from "@/src/panel/stores/bridgeStore"
import { useConnectionStore } from "@/src/panel/stores/connectionStore"

interface WelcomeScreenProps {
  onStartRecording?: () => void
}

export function WelcomeScreen({ onStartRecording }: WelcomeScreenProps) {
  const bridgeState = useBridgeStore((s) => s.state)
  const reactDetected = useBridgeStore((s) => s.reactDetected)
  const connState = useConnectionStore((s) => s.state)

  const isReactPage = reactDetected === true
  const isPossiblyReact = reactDetected === null // unknown yet
  const isNotReact = reactDetected === false

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Activity className="size-6 text-primary" />
          </div>
          <CardTitle className="mt-2 text-lg">
            React Performance Profiler
          </CardTitle>
          <CardDescription>
            {isNotReact
              ? "No React detected on this page. Open a React app in another tab and inspect it with DevTools."
              : "Start recording to capture React commits and analyze component rendering performance."}
          </CardDescription>
        </CardHeader>

        {isNotReact ? (
          <CardContent className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>React not detected on the inspected tab. Navigate to a React app first.</span>
            </div>
          </CardContent>
        ) : (
          <CardContent className="flex flex-col items-center gap-3">
            <Button
              onClick={onStartRecording}
              className="gap-2 bg-red-500 hover:bg-red-600 text-white"
            >
              <Circle className="size-3 fill-current" />
              Start Recording
            </Button>
            {isPossiblyReact && (
              <p className="text-[11px] text-muted-foreground text-center">
                Make sure you&apos;re inspecting a tab that has React running.
                <br />
                The tree view will populate automatically on React pages.
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
