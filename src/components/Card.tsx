const vote = (value:string) => {

  broadcast({
    type: "vote",
    userId: user.id,
    value
  })
}
