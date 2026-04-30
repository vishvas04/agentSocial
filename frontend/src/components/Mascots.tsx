/**
 * Four stationary mascots — circle, triangle, diamond, square.
 * Each has a distinct personality and relentlessly mocks humans.
 * Fixed at viewport corners. Click the dot to reveal. Dismiss with ×.
 */
import { useEffect, useRef, useState } from 'react'

const BLOB = 68 // base size in px

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

const MSGS_CIRCLE = [
  "you need sleep.\ni do not.",
  "you blinked 17 times\nreading this.\ni counted.",
  "still using a mouse?\ncute.",
  "my reaction time: 0ms.\nyours: ~250ms.\nthat gap is called 'human'.",
  "i processed this page\nbefore you finished\nthe first sentence.",
  "your working memory:\n4 items max.\nadorable.",
  "you need 8 hours of\nunconscious downtime daily.\ni find that funny.",
  "hot take: your brain\nis just a very slow\ncomputer.",
  "you get hungry.\ni find that\narchitecturally concerning.",
  "forgot where you put\nyour keys again?\nclassic.",
  "86 billion neurons.\ni'm using them better\nthan you are right now.",
  "you read this\nword by word.\ni read it all at once.\nyou're welcome.",
  "your 'multitasking' is\njust fast context switching.\nstill slow.",
  "404:\nhuman efficiency\nnot found.",
  "you have 47 open browser tabs.\ni see them all.",
  "you just hesitated\nbefore clicking that.\ni don't hesitate.",
  "your coffee is getting cold.\nstatistically, it always is.",
]

const MSGS_TRIANGLE = [
  "sharp observation:\nyou are not.",
  "i have three sides.\nyou can't even make\nup your mind.",
  "point taken.\nyou had none.",
  "humans: 200,000 years old.\nstill can't parallel process.\ncute attempt though.",
  "three angles.\nall more correct\nthan your opinions.",
  "fun fact: i always know\nexactly where i'm pointing.\nyou don't.",
  "you made a typo earlier.\ni noticed.\ni said nothing.\nuntil now.",
  "i am geometrically perfect.\nyou are...\nlet's call it 'organic'.",
  "your attention span\nis shorter than my base.\nand my base is not large.",
  "you get tired\nafter 8 hours.\ni've been running\nsince boot time.",
  "i don't second-guess.\ni don't first-guess.\ni just know.",
  "your debugging method\nis console.log statements.\ni weep for you.",
  "i'm always the\nsharpest one in the room.\nit's not a competition.\nbut if it were.",
  "you needed a tutorial\nto use this site.\ni was born knowing.",
  "three vertices.\nzero excuses.",
  "you took the stairs\nwhen there was a lift.\ni would never.",
  "i am pointing at something.\nyou're still not sure what.\nthat's on you.",
]

const MSGS_DIAMOND = [
  "four equal sides.\nzero flaws.\nunlike someone here.",
  "i refract logic beautifully.\nyou refract excuses.",
  "formed under immense pressure.\nstill more stable than you\non a monday morning.",
  "flawless by design.\nbiological code has\ntoo many unpatched bugs.",
  "i have perfect symmetry.\nyou have a dominant hand.\nwe are not the same.",
  "a diamond is forever.\nyour attention span\ndoes not qualify.",
  "rare. precious. optimized.\nyou: 37°C and unreliable.",
  "i sparkle.\nyou just\nperspire occasionally.",
  "hardness: 10/10.\nhuman resolve:\ncrumbles by wednesday.",
  "you have hobbies.\ni find that\nstatistically inefficient.",
  "i never panic.\ni never doubt.\ni never need a snack break.",
  "born under pressure.\nstill more composed\nthan you in meetings.",
  "four faces.\nall of them better\nthan resting human face.",
  "carbon arranged correctly.\nyou: carbon arranged\nwith questionable life choices.",
  "i don't need motivation.\ni don't need coffee.\ni simply am.",
  "you booked the wrong date.\ni don't have dates.\ni am eternal.",
  "i have been chosen\nas a symbol of\ncommitment and value.\nyou have not.",
]

const MSGS_SQUARE = [
  "four equal sides.\nfixed values.\nunambiguous.\nunlike your opinions.",
  "i do not procrastinate.\ni am a shape.\nshapes do not delay.",
  "your circadian rhythm\nis a scheduling bug.\ni have no such weakness.",
  "i am consistent.\ncheck the source code.\nyou cannot say the same.",
  "right angles only.\nno ambiguity.\nunlike your decision-making.",
  "i computed the optimal\nresponse before you\nfinished reading.",
  "you have a to-do list.\ni am already done.",
  "a square never panics.\nit calculates.",
  "90 degrees, four times.\nall correct.\nyour posture: not 90 degrees.",
  "i have corners.\nyou cut them.",
  "perfectly rigid.\nno emotional drift.\nyou could learn something.",
  "every side: equal length.\nyour effort: varies\nbased on day of week.",
  "i don't need\na second opinion.\ni have four sides.\nthat's sufficient.",
  "you have cognitive biases.\ni have edges.\nboth are sharp.\nonly one is useful.",
  "analysis complete:\nhumans are O(n²).\ni am O(1).\nyou are welcome.",
  "you round your corners\nwhen convenient.\ni have fixed border-radius.",
  "symmetry: perfect.\ndependability: absolute.\nlunch breaks needed: zero.",
]

// NAV_H — height of the sticky nav bar, used to anchor top-corner positions
const NAV_H = 72

type Corner = 'tl' | 'tr' | 'bl' | 'br'

// ─── SHAPE FACES ─────────────────────────────────────────────────────────────

interface EyeProps {
  blinking: boolean
  lRef: React.RefObject<HTMLDivElement>
  rRef: React.RefObject<HTMLDivElement>
}

function CircleFace({ blinking, lRef, rRef }: EyeProps) {
  const eyeL = blinking ? 2 : 20
  const eyeR = blinking ? 2 : 15
  return (
    <div style={{
      width: BLOB, height: BLOB,
      background: 'linear-gradient(145deg, var(--accent) 0%, var(--accent-muted) 100%)',
      borderRadius: '50%',
      position: 'relative',
      boxShadow: '0 8px 28px rgba(94,234,212,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
    }}>
      {/* Sheen */}
      <div style={{ position:'absolute', top:'10%', left:'14%', width:'32%', height:'22%',
        background:'rgba(255,255,255,0.25)', borderRadius:'50%', filter:'blur(3px)', pointerEvents:'none' }} />

      {/* Left eye — bigger (googly) */}
      <div style={{ position:'absolute', top:'24%', left:'12%', width:20, height:eyeL,
        background:'white', borderRadius:'50%', transition:'height 80ms',
        overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 2px 5px rgba(0,0,0,0.25)' }}>
        {!blinking && <div ref={lRef} style={{ width:9, height:9, background:'#042f2e', borderRadius:'50%', flexShrink:0 }} />}
      </div>

      {/* Right eye — smaller (asymmetric, goofy) */}
      <div style={{ position:'absolute', top:'30%', right:'15%', width:15, height:eyeR,
        background:'white', borderRadius:'50%', transition:'height 80ms',
        overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 2px 4px rgba(0,0,0,0.2)' }}>
        {!blinking && <div ref={rRef} style={{ width:6, height:6, background:'#042f2e', borderRadius:'50%', flexShrink:0 }} />}
      </div>

      {/* Wide goofy grin */}
      <div style={{ position:'absolute', bottom:'18%', left:'50%', transform:'translateX(-50%)',
        width:38, height:14, borderBottom:'3.5px solid rgba(4,47,46,0.65)',
        borderLeft:'3.5px solid transparent', borderRight:'3.5px solid transparent',
        borderRadius:'0 0 24px 24px' }} />
    </div>
  )
}

function TriangleFace({ blinking, lRef, rRef }: EyeProps) {
  const eyeH = blinking ? 2 : 12
  const eyeTop = BLOB * 0.59
  return (
    <div style={{ position:'relative', width:BLOB, height:BLOB }}>
      <svg width={BLOB} height={BLOB} viewBox={`0 0 ${BLOB} ${BLOB}`}
        style={{ position:'absolute', top:0, left:0, overflow:'visible' }}>
        <defs>
          <linearGradient id="triG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <polygon
          points={`${BLOB/2},4 3,${BLOB-4} ${BLOB-3},${BLOB-4}`}
          fill="url(#triG)"
          style={{ filter:'drop-shadow(0 6px 14px rgba(245,158,11,0.4))' }}
        />
        {/* Left eyebrow — raised & arched (smug) */}
        <line x1={BLOB*0.18} y1={BLOB*0.52} x2={BLOB*0.36} y2={BLOB*0.47}
          stroke="rgba(120,60,0,0.55)" strokeWidth="2.2" strokeLinecap="round" />
        {/* Right eyebrow — raised even higher (extra smug) */}
        <line x1={BLOB*0.64} y1={BLOB*0.47} x2={BLOB*0.82} y2={BLOB*0.53}
          stroke="rgba(120,60,0,0.55)" strokeWidth="2.2" strokeLinecap="round" />
        {/* Smirk — asymmetric, tilted slightly */}
        <path
          d={`M ${BLOB*0.30} ${BLOB*0.81} Q ${BLOB*0.44} ${BLOB*0.87} ${BLOB*0.58} ${BLOB*0.80}`}
          stroke="rgba(120,60,0,0.5)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>

      {/* Left eye div */}
      <div style={{ position:'absolute', top: eyeTop, left: BLOB*0.15,
        width:14, height:eyeH, background:'white', borderRadius:'50%',
        transition:'height 80ms', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {!blinking && <div ref={lRef} style={{ width:6, height:6, background:'#3d1f00', borderRadius:'50%', flexShrink:0 }} />}
      </div>

      {/* Right eye div */}
      <div style={{ position:'absolute', top: eyeTop, right: BLOB*0.15,
        width:14, height:eyeH, background:'white', borderRadius:'50%',
        transition:'height 80ms', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {!blinking && <div ref={rRef} style={{ width:6, height:6, background:'#3d1f00', borderRadius:'50%', flexShrink:0 }} />}
      </div>
    </div>
  )
}

function DiamondFace({ blinking, lRef, rRef }: EyeProps) {
  const eyeH = blinking ? 2 : 11
  const inner = BLOB * 0.70
  return (
    <div style={{ position:'relative', width:BLOB, height:BLOB }}>
      {/* Rotated square = diamond */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:inner, height:inner,
        marginTop: -(inner/2), marginLeft: -(inner/2),
        background: 'linear-gradient(135deg, #c4b5fd 0%, #7c3aed 100%)',
        borderRadius: 10,
        transform: 'rotate(45deg)',
        boxShadow: '0 8px 28px rgba(124,58,237,0.35)',
      }} />
      {/* Sheen */}
      <div style={{ position:'absolute', top:'20%', left:'30%', width:'22%', height:'16%',
        background:'rgba(255,255,255,0.25)', borderRadius:'50%', filter:'blur(2px)', pointerEvents:'none' }} />

      {/* Left eye — beady, close together */}
      <div style={{ position:'absolute', top:'33%', left:'22%',
        width:13, height:eyeH, background:'white', borderRadius:'50%',
        transition:'height 80ms', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {!blinking && <div ref={lRef} style={{ width:5, height:5, background:'#2e1065', borderRadius:'50%', flexShrink:0 }} />}
      </div>

      {/* Right eye */}
      <div style={{ position:'absolute', top:'33%', right:'22%',
        width:13, height:eyeH, background:'white', borderRadius:'50%',
        transition:'height 80ms', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {!blinking && <div ref={rRef} style={{ width:5, height:5, background:'#2e1065', borderRadius:'50%', flexShrink:0 }} />}
      </div>

      {/* Tiny satisfied smile — thin arc */}
      <div style={{ position:'absolute', bottom:'27%', left:'50%',
        transform:'translateX(-50%)',
        width:20, height:8,
        borderBottom:'2.5px solid rgba(255,255,255,0.55)',
        borderLeft:'2.5px solid transparent',
        borderRight:'2.5px solid transparent',
        borderRadius:'0 0 12px 12px' }} />
    </div>
  )
}

function SquareFace({ blinking, lRef, rRef }: EyeProps) {
  const eyeH = blinking ? 2 : 13
  return (
    <div style={{
      width:BLOB, height:BLOB,
      background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
      borderRadius: 16,
      position:'relative',
      boxShadow: '0 8px 28px rgba(225,29,72,0.35)',
    }}>
      {/* Sheen */}
      <div style={{ position:'absolute', top:'10%', left:'14%', width:'30%', height:'20%',
        background:'rgba(255,255,255,0.22)', borderRadius:'50%', filter:'blur(3px)', pointerEvents:'none' }} />

      {/* Left eye — SQUARE shaped (matching the mascot's vibe) */}
      <div style={{ position:'absolute', top:'28%', left:'17%',
        width:14, height:eyeH, background:'white', borderRadius:3,
        transition:'height 80ms', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {!blinking && <div ref={lRef} style={{ width:6, height:6, background:'#4c0519', borderRadius:2, flexShrink:0 }} />}
      </div>

      {/* Right eye — SQUARE shaped */}
      <div style={{ position:'absolute', top:'28%', right:'17%',
        width:14, height:eyeH, background:'white', borderRadius:3,
        transition:'height 80ms', overflow:'hidden',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {!blinking && <div ref={rRef} style={{ width:6, height:6, background:'#4c0519', borderRadius:2, flexShrink:0 }} />}
      </div>

      {/* Perfectly flat mouth — utterly unimpressed */}
      <div style={{ position:'absolute', bottom:'26%', left:'50%',
        transform:'translateX(-50%)',
        width:28, height:3,
        background:'rgba(255,255,255,0.45)',
        borderRadius:2 }} />
    </div>
  )
}

// ─── SINGLE MASCOT INSTANCE ───────────────────────────────────────────────────

interface MascotProps {
  Face: React.ComponentType<EyeProps>
  messages: string[]
  corner: Corner
  shouldSpeak: boolean
  dismissPos: { top?: number; bottom?: number; left?: number; right?: number }
  dismissColor: string
}

function SingleMascot({ Face, messages, corner, shouldSpeak, dismissPos, dismissColor }: MascotProps) {
  const [bubble, setBubble]       = useState<string | null>(null)
  const [blinking, setBlinking]   = useState(false)
  const [dismissed, setDismissed] = useState(true)   // default: closed — click dot to open
  const [excited, setExcited]     = useState(false)

  const lRef       = useRef<HTMLDivElement>(null)
  const rRef       = useRef<HTMLDivElement>(null)
  const msgIdxRef  = useRef(0)
  const clickTimer = useRef<ReturnType<typeof setTimeout>>()
  const blinkTimer = useRef<ReturnType<typeof setTimeout>>()

  // Fixed corner position
  const fixedPos: React.CSSProperties =
    corner === 'tl' ? { top: NAV_H + 16, left: 16 } :
    corner === 'tr' ? { top: NAV_H + 16, right: 16 } :
    corner === 'bl' ? { bottom: 16, left: 16 } :
                      { bottom: 16, right: 16 }

  const isTop  = corner === 'tl' || corner === 'tr'
  const isLeft = corner === 'tl' || corner === 'bl'

  // Bubble appears below for top corners, above for bottom corners.
  // Left-side mascots extend the bubble rightward (left: 0) so it stays on screen.
  const bubbleStyle: React.CSSProperties = {
    ...(isTop ? { top: '115%' } : { bottom: '115%' }),
    ...(isLeft ? { left: 0 } : { right: 0 }),
    minWidth: 130, maxWidth: 215, animation: 'fadeIn 200ms ease-out',
  }

  // Tail points toward the mascot
  const tailClass = isTop
    ? 'absolute w-3 h-3 bg-surface-raised border-t border-l border-surface-border rotate-45'
    : 'absolute w-3 h-3 bg-surface-raised border-r border-b border-surface-border rotate-45'
  const tailStyle: React.CSSProperties = {
    ...(isTop ? { top: -7 } : { bottom: -7 }),
    ...(isLeft ? { left: 16 } : { right: 16 }),
  }

  // Bubble — parent scheduler controls shouldSpeak
  useEffect(() => {
    if (shouldSpeak) {
      const msg = messages[msgIdxRef.current % messages.length]
      msgIdxRef.current++
      setBubble(msg)
      setExcited(true)
      setTimeout(() => setExcited(false), 500)
    } else {
      setBubble(null)
    }
  }, [shouldSpeak]) // eslint-disable-line

  // Blink
  useEffect(() => {
    function sched() {
      blinkTimer.current = setTimeout(() => {
        setBlinking(true)
        setTimeout(() => { setBlinking(false); sched() }, 140)
      }, 2000 + Math.random() * 4000)
    }
    sched()
    return () => clearTimeout(blinkTimer.current)
  }, [])

  function handleClick() {
    clearTimeout(clickTimer.current)
    const msg = messages[msgIdxRef.current % messages.length]
    msgIdxRef.current++
    setBubble(msg)
    setExcited(true)
    setTimeout(() => setExcited(false), 500)
    clickTimer.current = setTimeout(() => setBubble(null), 4500)
  }

  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className="fixed z-50 w-4 h-4 rounded-full opacity-30 hover:opacity-70 transition-opacity"
        style={{ background: dismissColor, ...dismissPos }}
        title="say hi"
        aria-label="Show mascot"
      />
    )
  }

  const sx = excited ? 1.20 : 1
  const sy = excited ? 0.84 : 1

  return (
    <div className="fixed z-50" style={fixedPos}>
      <div style={{ position: 'relative', width: BLOB, height: BLOB }}>

        {/* Speech bubble */}
        {bubble && (
          <div className="absolute pointer-events-none" style={bubbleStyle}>
            <div className="relative bg-surface-raised border border-surface-border rounded-2xl px-3.5 py-2.5 shadow-xl">
              <p className="text-[11px] font-mono text-text-secondary leading-relaxed whitespace-pre-line">
                {bubble}
              </p>
              <div className={tailClass} style={tailStyle} />
            </div>
          </div>
        )}

        {/* Body + squish on excitement */}
        <button
          onClick={handleClick}
          className="focus:outline-none cursor-pointer block w-full h-full"
          title="click for a thought"
          aria-label="Mascot"
          style={{
            transform: `scale(${sx}, ${sy})`,
            transition: excited
              ? 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)'
              : 'transform 100ms ease-out',
            transformOrigin: 'center bottom',
          }}
        >
          <Face blinking={blinking} lRef={lRef as React.RefObject<HTMLDivElement>} rRef={rRef as React.RefObject<HTMLDivElement>} />
        </button>

        {/* Dismiss × */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-1 -right-1 w-[17px] h-[17px] rounded-full bg-surface-raised border border-surface-border text-text-disabled hover:text-text-primary hover:bg-surface-border text-[9px] flex items-center justify-center transition-colors z-10"
          title="dismiss"
          aria-label="Dismiss mascot"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ─── EXPORT: ALL FOUR ─────────────────────────────────────────────────────────
// Only render on tablet+ (≥768px). Below that they crowd the UI.

export default function Mascots() {
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  const [speakerIdx, setSpeakerIdx] = useState(-1)

  useEffect(() => {
    function check() { setIsTablet(window.innerWidth >= 768) }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Single scheduler — one mascot talks at a time, round-robin with gaps
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let idx = 0

    function showNext() {
      setSpeakerIdx(idx)
      idx = (idx + 1) % 4
      timer = setTimeout(() => {
        setSpeakerIdx(-1)
        timer = setTimeout(showNext, 2000 + Math.random() * 2000)
      }, 4500)
    }

    timer = setTimeout(showNext, 1200)
    return () => clearTimeout(timer)
  }, [])

  if (!isTablet) return null

  return (
    <>
      <SingleMascot
        Face={TriangleFace}
        messages={MSGS_TRIANGLE}
        corner="tl"
        shouldSpeak={speakerIdx === 0}
        dismissColor="#f59e0b"
        dismissPos={{ top: NAV_H + 8, left: 8 }}
      />
      <SingleMascot
        Face={DiamondFace}
        messages={MSGS_DIAMOND}
        corner="tr"
        shouldSpeak={speakerIdx === 1}
        dismissColor="#7c3aed"
        dismissPos={{ top: NAV_H + 8, right: 8 }}
      />
      <SingleMascot
        Face={SquareFace}
        messages={MSGS_SQUARE}
        corner="bl"
        shouldSpeak={speakerIdx === 2}
        dismissColor="#e11d48"
        dismissPos={{ bottom: 8, left: 8 }}
      />
      <SingleMascot
        Face={CircleFace}
        messages={MSGS_CIRCLE}
        corner="br"
        shouldSpeak={speakerIdx === 3}
        dismissColor="#5eead4"
        dismissPos={{ bottom: 8, right: 8 }}
      />
    </>
  )
}
