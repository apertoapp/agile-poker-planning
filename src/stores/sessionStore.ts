export const updateSession = (newState:any) => {

  sessionStore.set({
    ...newState
  })
}
