import { useEffect } from "react"
import { useParams } from "react-router-dom"

import {
  createHost,
  joinHost,
  broadcast
} from "../realtime/peerService"

import {
  sessionStore,
  updateSession
} from "../stores/sessionStore"

export default function SessionPage() {

  const { sessionId } = useParams()

  const params = new URLSearchParams(window.location.search)
  const isHost = params.get("host") === "true"

  const user = JSON.parse(localStorage.getItem("user") || "{}")

  let session:any

  sessionStore.subscribe(s => {
    session = s
  })

  // 🔗 Connexion P2P
  useEffect(() => {

    if (!sessionId) return

    const onMessage = (msg:any) => {

      if (msg.type === "session-update") {
        updateSession(msg.session)
      }

      if (msg.type === "vote") {

        session.votes[msg.userId] = msg.value

        broadcast({
          type: "session-update",
          session
        })
      }
    }

    if (isHost) {

      createHost(sessionId, onMessage)

    } else {

      joinHost(sessionId, onMessage)
    }

  }, [])

  // 🟢 VOTER
  const vote = (value:string) => {

    broadcast({
      type: "vote",
      userId: user.id,
      value
    })
  }

  // ✅ 6️⃣ REVEAL
  const reveal = () => {

    session.revealed = true

    broadcast({
      type: "session-update",
      session
    })
  }

  // ✅ 7️⃣ RESET
  const reset = () => {

    session.votes = {}
    session.revealed = false

    broadcast({
      type: "session-update",
      session
    })
  }

  return (
    <div>

      <h2>Session : {sessionId}</h2>

      {!session?.revealed && isHost && (
        <button onClick={reveal}>
          Reveal Votes
        </button>
      )}

      {session?.revealed && isHost && (
        <button onClick={reset}>
          Reset Votes
        </button>
      )}

      <div>
        {["1","2","3","5","8","13"].map(v => (
          <button
            key={v}
            onClick={() => vote(v)}
          >
            {v}
          </button>
        ))}
      </div>

    </div>
  )
}
