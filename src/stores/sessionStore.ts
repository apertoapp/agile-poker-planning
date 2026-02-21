import { useSyncExternalStore } from "react"

let sessionState:any = null
let listeners:any[] = []

export const updateSession = (newState:any) => {

  sessionState = {
    ...sessionState,
    ...newState
  }

  listeners.forEach(l => l())
}

export const useSessionStore = () => {

  return useSyncExternalStore(

    (listener) => {
      listeners.push(listener)
      return () => {
        listeners = listeners.filter(l => l !== listener)
      }
    },

    () => sessionState
  )
}
