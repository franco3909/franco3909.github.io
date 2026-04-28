"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Users } from "lucide-react"

export default function Home() {
  const [sessionId, setSessionId] = useState("")
  const router = useRouter()

  const createNewTimer = () => {
    const newSessionId = Math.random().toString(36).substring(2, 10)
    router.push(`/${newSessionId}`)
  }

  const joinSession = (e: React.FormEvent) => {
    e.preventDefault()
    if (sessionId.trim()) {
      router.push(`/${sessionId.trim()}`)
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Countdown Timer</h1>
          <p className="text-muted-foreground">
            Create a new timer or join an existing session
          </p>
        </div>

        <div className="space-y-6">
          <Button
            onClick={createNewTimer}
            className="w-full h-14 text-lg"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Timer
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or join existing
              </span>
            </div>
          </div>

          <form onSubmit={joinSession} className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter session ID"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="h-12 text-center text-lg tracking-widest"
              />
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="h-12 px-6"
                disabled={!sessionId.trim()}
              >
                <Users className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Enter the session ID shared with you to view the same timer
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
