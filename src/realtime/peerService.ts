let peer:any = null
let connections:any[] = []

export const createHost = (
  sessionId:string,
  onMessage:any,
  getSession:any
) => {

  peer = new (window as any).Peer(sessionId)

  peer.on("connection", (conn:any) => {

    connections.push(conn)

    conn.on("open", () => {

      // ✅ ENVOI SESSION INITIALE AU PARTICIPANT
      const session = getSession()

      conn.send({
        type: "session-update",
        session
      })
    })

    conn.on("data", onMessage)
  })
}

export const joinHost = (
  sessionId:string,
  onMessage:any
) => {

  peer = new (window as any).Peer()

  const conn = peer.connect(sessionId)

  conn.on("open", () => {
    connections.push(conn)
  })

  conn.on("data", onMessage)
}

export const broadcast = (msg:any) => {

  connections.forEach(c => {

    if (c.open) {
      c.send(msg)
    }
  })
}
