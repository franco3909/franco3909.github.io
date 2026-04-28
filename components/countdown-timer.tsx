"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Pause, RotateCcw, Copy, Check, Plus, Home, QrCode, X } from "lucide-react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { createClient } from "@/lib/supabase/client"

interface TimerState {
  id: string
  total_seconds: number
  remaining_seconds: number
  is_running: boolean
  last_updated_at: string
}

export function CountdownTimer({ sessionId }: { sessionId: string }) {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(5)
  const [seconds, setSeconds] = useState(0)
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const supabase = useRef(createClient()).current
  const localStartTimeRef = useRef<number | null>(null)
  const localStartSecondsRef = useRef<number>(0)

  const formatTime = (time: number) => String(time).padStart(2, "0")

  const calculateTotalSeconds = useCallback(() => {
    return hours * 3600 + minutes * 60 + seconds
  }, [hours, minutes, seconds])

  // Calculate actual remaining time based on server timestamp
  const calculateActualRemaining = useCallback((timerData: TimerState) => {
    if (!timerData.is_running) return timerData.remaining_seconds
    
    const lastUpdated = new Date(timerData.last_updated_at).getTime()
    const now = Date.now()
    const elapsed = Math.floor((now - lastUpdated) / 1000)
    return Math.max(0, timerData.remaining_seconds - elapsed)
  }, [])

  // Initialize display seconds when timer changes
  const syncDisplaySeconds = useCallback((timerData: TimerState) => {
    const actualRemaining = calculateActualRemaining(timerData)
    setDisplaySeconds(actualRemaining)
    
    if (timerData.is_running) {
      localStartTimeRef.current = Date.now()
      localStartSecondsRef.current = actualRemaining
    } else {
      localStartTimeRef.current = null
    }
  }, [calculateActualRemaining])

  // Fetch or create timer session
  useEffect(() => {
    async function fetchOrCreateTimer() {
      setIsLoading(true)
      
      const { data: existingTimer } = await supabase
        .from("timers")
        .select("*")
        .eq("id", sessionId)
        .single()

      if (existingTimer) {
        setTimer(existingTimer)
        syncDisplaySeconds(existingTimer)
      } else {
        const newTimer: TimerState = {
          id: sessionId,
          total_seconds: 300,
          remaining_seconds: 300,
          is_running: false,
          last_updated_at: new Date().toISOString(),
        }
        
        await supabase.from("timers").insert(newTimer)
        setTimer(newTimer)
        setDisplaySeconds(300)
      }
      
      setIsLoading(false)
    }

    fetchOrCreateTimer()
  }, [sessionId, supabase, syncDisplaySeconds])

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`timer-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "timers",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newTimer = payload.new as TimerState
          setTimer(newTimer)
          syncDisplaySeconds(newTimer)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase, syncDisplaySeconds])

  // Local countdown tick using requestAnimationFrame for accuracy
  useEffect(() => {
    if (!timer?.is_running || localStartTimeRef.current === null) return

    let animationId: number
    let lastSecond = localStartSecondsRef.current

    const tick = () => {
      if (localStartTimeRef.current === null) return
      
      const elapsed = Math.floor((Date.now() - localStartTimeRef.current) / 1000)
      const remaining = Math.max(0, localStartSecondsRef.current - elapsed)
      
      if (remaining !== lastSecond) {
        lastSecond = remaining
        setDisplaySeconds(remaining)
        
        if (remaining <= 0) {
          // Update database when timer completes
          supabase.from("timers").update({
            remaining_seconds: 0,
            is_running: false,
            last_updated_at: new Date().toISOString(),
          }).eq("id", sessionId).then()
          
          setTimer((prev) => prev ? { ...prev, remaining_seconds: 0, is_running: false } : prev)
          localStartTimeRef.current = null
          return
        }
      }
      
      animationId = requestAnimationFrame(tick)
    }

    animationId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animationId)
  }, [timer?.is_running, sessionId, supabase])

  const updateTimer = async (updates: Partial<TimerState>) => {
    const newState = {
      ...updates,
      last_updated_at: new Date().toISOString(),
    }
    
    await supabase
      .from("timers")
      .update(newState)
      .eq("id", sessionId)
    
    setTimer((prev) => prev ? { ...prev, ...newState } : prev)
  }

  const handleStart = async () => {
    if (!timer) return
    
    if (displaySeconds === 0 || displaySeconds === timer.total_seconds) {
      const total = calculateTotalSeconds()
      if (total > 0) {
        localStartTimeRef.current = Date.now()
        localStartSecondsRef.current = total
        setDisplaySeconds(total)
        await updateTimer({
          total_seconds: total,
          remaining_seconds: total,
          is_running: true,
        })
      }
    } else {
      localStartTimeRef.current = Date.now()
      localStartSecondsRef.current = displaySeconds
      await updateTimer({ 
        remaining_seconds: displaySeconds,
        is_running: true 
      })
    }
  }

  const handlePause = async () => {
    if (!timer) return
    localStartTimeRef.current = null
    await updateTimer({
      remaining_seconds: displaySeconds,
      is_running: false,
    })
  }

  const handleReset = async () => {
    localStartTimeRef.current = null
    const resetSeconds = timer?.total_seconds || 300
    setDisplaySeconds(resetSeconds)
    await updateTimer({
      remaining_seconds: resetSeconds,
      is_running: false,
    })
    setHours(0)
    setMinutes(5)
    setSeconds(0)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const createNewTimer = () => {
    const newId = Math.random().toString(36).substring(2, 10)
    window.location.href = `/${newId}`
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading timer...</p>
      </div>
    )
  }

  const hasStarted = timer && (timer.is_running || displaySeconds < timer.total_seconds)
  const displayHours = hasStarted ? Math.floor(displaySeconds / 3600) : hours
  const displayMinutes = hasStarted ? Math.floor((displaySeconds % 3600) / 60) : minutes
  const displaySecondsValue = hasStarted ? displaySeconds % 60 : seconds

  const progress = timer && timer.total_seconds > 0 
    ? (displaySeconds / timer.total_seconds) * 100 
    : 100

  const isRunning = timer?.is_running ?? false
  const isTimeUp = timer && displaySeconds === 0 && !timer.is_running && timer.remaining_seconds === 0 && timer.total_seconds > 0

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Title - Hidden when running */}
      {!isRunning && (
        <h1 className="text-3xl font-bold text-center text-foreground">
          Countdown Timer
        </h1>
      )}

      {/* Session ID Badge - Hidden when running */}
      {!isRunning && (
        <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-full">
          <span className="text-sm text-muted-foreground">Session:</span>
          <code className="text-sm font-mono font-medium">{sessionId}</code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={copyLink}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowQR(true)}
          >
            <QrCode className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowQR(false)}>
          <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold">Scan to join</h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowQR(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG value={typeof window !== "undefined" ? window.location.href : ""} size={200} />
            </div>
            <code className="text-sm text-muted-foreground">{sessionId}</code>
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <span className={`text-7xl font-mono font-semibold tracking-tight transition-colors ${isTimeUp ? "text-red-500" : "text-foreground"}`}>
          {formatTime(displayHours)}:{formatTime(displayMinutes)}:{formatTime(displaySecondsValue)}
        </span>
        
        {/* Progress Bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${isTimeUp ? "bg-red-500" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Input Fields - Only show when not started */}
      {!hasStarted && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <Input
              type="number"
              min={0}
              max={99}
              value={hours}
              onChange={(e) => setHours(Math.min(99, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-20 text-center text-lg font-mono"
            />
            <span className="text-xs text-muted-foreground">Hours</span>
          </div>
          <span className="text-2xl font-semibold text-muted-foreground mb-5">:</span>
          <div className="flex flex-col items-center gap-1">
            <Input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-20 text-center text-lg font-mono"
            />
            <span className="text-xs text-muted-foreground">Minutes</span>
          </div>
          <span className="text-2xl font-semibold text-muted-foreground mb-5">:</span>
          <div className="flex flex-col items-center gap-1">
            <Input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-20 text-center text-lg font-mono"
            />
            <span className="text-xs text-muted-foreground">Seconds</span>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-4">
        {!timer?.is_running ? (
          <Button
            size="lg"
            onClick={handleStart}
            disabled={!hasStarted && calculateTotalSeconds() === 0}
            className="gap-2 px-8"
          >
            <Play className="w-5 h-5" />
            {hasStarted ? "Resume" : "Start"}
          </Button>
        ) : (
          <Button size="lg" onClick={handlePause} variant="secondary" className="gap-2 px-8">
            <Pause className="w-5 h-5" />
            Pause
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-5 h-5" />
          Reset
        </Button>
      </div>

      {/* Completion Message */}
      {isTimeUp && (
        <div className="text-center animate-pulse">
          <p className="text-xl font-semibold text-red-500">Time&apos;s up!</p>
        </div>
      )}

      {/* Action Buttons - Hidden when running */}
      {!isRunning && (
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={createNewTimer}
            className="gap-2 text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
            Create New Timer
          </Button>
          <Button
            variant="ghost"
            asChild
            className="gap-2 text-muted-foreground"
          >
            <Link href="/">
              <Home className="w-4 h-4" />
              Home
            </Link>
          </Button>
        </div>
      )}

      {/* Description - Hidden when running */}
      {!isRunning && (
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Share the link to let others view and control this timer in real-time
        </p>
      )}
    </div>
  )
}
