



function draw(delaunay, planes, polygons, config) {

  ctx.clearRect(0, 0, w, h)

  drawAxes()

  drawPlanesAndHull(planes, polygons, delaunay)


  const triangles = delaunay.triangles

  // Triangles
  if (config.drawTriangles) {
    ctx.beginPath()
    ctx.fillStyle = 'black'
    for (let i = 0; i < triangles.length; i += 3) {
      const p0 = triangles[i]
      const p1 = triangles[i + 1]
      const p2 = triangles[i + 2]
      const pc = getCentroid(points[p0], points[p1], points[p2])
      ctx.moveTo(getX(p0), getY(p0))
      ctx.lineTo(getX(p1), getY(p1))
      ctx.lineTo(getX(p2), getY(p2))
      // ctx.fillText((i / 3).toString(), getXPad(pc[0]), getYPad(pc[1]))
      ctx.closePath()
    }
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }


  // Hull
  ctx.beginPath()
  for (const i of delaunay.hull) {
    ctx.lineTo(getX(i), getY(i))
  }
  ctx.closePath()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'red'
  ctx.stroke()

  // Points
  if (config.drawPoints) {
    ctx.fillStyle = 'black'
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      ctx.rect(getX(i) - 1.5, getY(i) - 1.5, 3, 3)
    }
    ctx.fill()
  }
}