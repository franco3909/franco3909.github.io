import { CountdownTimer } from "@/components/countdown-timer"

export default async function TimerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <CountdownTimer sessionId={sessionId} />
      </div>
    </main>
  )
}
